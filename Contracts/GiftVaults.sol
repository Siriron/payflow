// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts@5.6.1/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.6.1/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts@5.6.1/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts@5.6.1/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts@5.6.1/utils/cryptography/EIP712.sol";

/// @notice Holds the USDC of one gift. Deployed lazily by GiftVaults at an address that is known in advance,
///         so USDC can be sent there (by a CCTP mint or a plain transfer) before the vault exists.
///         Only the GiftVaults contract that deployed it can move funds out.
contract GiftVault {
    using SafeERC20 for IERC20;

    address private immutable ESCROW;

    error NotEscrow();

    constructor() {
        ESCROW = msg.sender;
    }

    /// @notice Sends the vault's whole token balance to `to`. Returns the amount sent.
    function sweep(IERC20 token, address to) external returns (uint256 amount) {
        if (msg.sender != ESCROW) revert NotEscrow();
        amount = token.balanceOf(address(this));
        if (amount > 0) token.safeTransfer(to, amount);
    }
}

/// @title GiftVaults
/// @notice USDC gift links without a deposit step. Each gift has its own vault address, derived from
///         (sender, claimSigner, expiry). The sender simply sends USDC to that address, from any chain Payflow
///         supports (a CCTP mint to the vault address, or a plain transfer on Arc), then shares a claim link.
///         Whoever holds the link can claim everything in the vault to a wallet of their choice before expiry;
///         the sender can sweep it back after expiry. Non-custodial: no owner, admin, fee, upgrade path or
///         payable function, and nothing here can move funds except by these two rules.
///
/// @dev Model
///  - `claimSigner` is the address of a throwaway key the sender creates in their browser. Its private key
///    is the claim secret and travels in the link's URL fragment (never sent to a server).
///  - To claim, the key holder signs an EIP-712 `Claim(address vault, address recipient)` message off-chain.
///    The signature commits to the recipient, so someone who sees the claim transaction in the mempool cannot
///    redirect the funds. Anyone may submit the transaction; the funds always go to the signed recipient.
///  - Claim is possible strictly before `expiry`; reclaim at or after it, and only by the original sender
///    (the vault address depends on the sender, so nobody else can derive it).
///  - Both paths pay out the vault's whole balance at that moment. Nothing is recorded on chain until then,
///    so a gift is only as recoverable as its (claimSigner, expiry): the sender must keep them.
///  - Bearer property: whoever holds the claim key can claim until expiry.
contract GiftVaults is EIP712, ReentrancyGuard {
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address vault,address recipient)");

    /// @notice The only token handled (USDC's ERC-20 interface).
    IERC20 public immutable TOKEN;

    bytes32 private immutable VAULT_INIT_CODE_HASH;

    event GiftClaimed(address indexed vault, address indexed claimSigner, address indexed recipient, uint256 amount);
    event GiftReclaimed(address indexed vault, address indexed sender, address to, uint256 amount);

    error ZeroAddress();
    error NotAContract();
    error Expired();
    error NotExpired();
    error BadSignature();
    error NothingToSweep();
    error VaultAddressMismatch();

    constructor(IERC20 token) EIP712("Payflow GiftVaults", "1") {
        if (address(token) == address(0)) revert ZeroAddress();
        if (address(token).code.length == 0) revert NotAContract();
        TOKEN = token;
        VAULT_INIT_CODE_HASH = keccak256(type(GiftVault).creationCode);
    }

    /// @notice The vault address of a gift. Send USDC here to fund it. Always ask the contract: the address
    ///         depends on this deployment's bytecode, so it cannot be computed from the source alone.
    function vaultOf(address sender, address claimSigner, uint64 expiry) public view returns (address) {
        return _predict(_salt(sender, claimSigner, expiry));
    }

    /// @notice Pay the vault's whole balance to `recipient`. `signature` is `claimSigner`'s EIP-712 signature
    ///         over `Claim(vault, recipient)`.
    function claim(address sender, address claimSigner, uint64 expiry, address recipient, bytes calldata signature)
        external
        nonReentrant
    {
        if (sender == address(0) || claimSigner == address(0) || recipient == address(0)) revert ZeroAddress();
        if (block.timestamp >= expiry) revert Expired();

        bytes32 salt = _salt(sender, claimSigner, expiry);
        address vault = _predict(salt);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, vault, recipient)));
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || signer != claimSigner) revert BadSignature();

        uint256 amount = _sweep(salt, vault, recipient);
        emit GiftClaimed(vault, claimSigner, recipient, amount);
    }

    /// @notice The sender takes the vault's balance back once the gift has expired. `to` can be any address,
    ///         so a sender whose own address cannot receive the token can still recover the funds.
    function reclaim(address claimSigner, uint64 expiry, address to) external nonReentrant {
        if (claimSigner == address(0) || to == address(0)) revert ZeroAddress();
        if (block.timestamp < expiry) revert NotExpired();

        bytes32 salt = _salt(msg.sender, claimSigner, expiry);
        address vault = _predict(salt);
        uint256 amount = _sweep(salt, vault, to);
        emit GiftReclaimed(vault, msg.sender, to, amount);
    }

    /// @notice EIP-712 domain separator, exposed so clients can check what they sign against.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _salt(address sender, address claimSigner, uint64 expiry) private pure returns (bytes32) {
        return keccak256(abi.encode(sender, claimSigner, expiry));
    }

    function _predict(bytes32 salt) private view returns (address) {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, VAULT_INIT_CODE_HASH))))
        );
    }

    /// @dev Deploys the vault on first use, then sweeps it. Reverts (rolling back the deployment) if it is empty.
    function _sweep(bytes32 salt, address vault, address to) private returns (uint256 amount) {
        if (vault.code.length == 0) {
            if (address(new GiftVault{salt: salt}()) != vault) revert VaultAddressMismatch();
        }
        amount = GiftVault(vault).sweep(TOKEN, to);
        if (amount == 0) revert NothingToSweep();
    }
}
