// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts@5.6.1/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.6.1/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts@5.6.1/utils/ReentrancyGuard.sol";

/// @title PaymentRequests
/// @notice Pays a payment request and records on chain that it was paid, so a request link can be paid
///         exactly once and every browser can see its status.
///
/// @dev The contract never holds funds: `pay` moves USDC straight from the payer to the creator in one
///      call (`transferFrom(payer, creator)`). It has no owner, admin, fee, upgrade path or payable function.
///
///  - A request is identified by `keccak256(chainId, this, salt, creator, amount)`. The link carries
///    `salt`, `creator` and `amount`, and the contract derives the id itself, so a payment can only ever
///    mark the request whose creator and amount it actually paid. Paying a different creator or amount
///    is simply a different request.
///  - The first payment wins; any later `pay` for the same request reverts.
///  - Anyone can pay a request, and anyone can pay it first. Doing so only sends their own USDC to the
///    creator, so it cannot be used to take anything from anybody.
///  - The payer must have approved this contract for at least `amount` USDC. The contract can only move
///    funds of the account that calls `pay`, and only to the creator named in that same call.
contract PaymentRequests is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Payment {
        address payer; // slot 0: 20 bytes
        uint96 amount; //          12 bytes
        uint64 paidAt; // slot 1 (0 means not paid)
    }

    /// @notice Smallest request: 0.01 USDC (6 decimals).
    uint256 public constant MIN_AMOUNT = 10_000;

    /// @notice The only token handled (USDC's ERC-20 interface).
    IERC20 public immutable TOKEN;

    mapping(bytes32 requestId => Payment) private _payments;

    event RequestPaid(bytes32 indexed requestId, address indexed creator, address indexed payer, uint256 amount);

    error ZeroAddress();
    error InvalidCreator();
    error InvalidAmount();
    error SelfPayment();
    error AlreadyPaid();
    error UnexpectedTokenAmount();
    error NotAContract();

    constructor(IERC20 token) {
        if (address(token) == address(0)) revert ZeroAddress();
        if (address(token).code.length == 0) revert NotAContract();
        TOKEN = token;
    }

    /// @notice The id a request has on this contract. Same inputs always give the same id.
    function requestId(bytes32 salt, address creator, uint256 amount) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), salt, creator, amount));
    }

    /// @notice Pay `amount` of the token from the caller to `creator`, once per (salt, creator, amount).
    function pay(bytes32 salt, address creator, uint256 amount) external nonReentrant returns (bytes32 id) {
        if (creator == address(0) || creator == address(this) || creator == address(TOKEN)) revert InvalidCreator();
        if (creator == msg.sender) revert SelfPayment();
        if (amount < MIN_AMOUNT || amount > type(uint96).max) revert InvalidAmount();

        id = requestId(salt, creator, amount);
        Payment storage p = _payments[id];
        if (p.paidAt != 0) revert AlreadyPaid();

        // Effects before interaction.
        p.payer = msg.sender;
        // forge-lint: disable-next-line(unsafe-typecast)
        p.amount = uint96(amount); // safe: amount <= type(uint96).max is checked above
        p.paidAt = uint64(block.timestamp);

        // Interaction. The creator must end up with exactly `amount`, so a fee-on-transfer token can never
        // record a request as paid when it was not.
        uint256 before = TOKEN.balanceOf(creator);
        TOKEN.safeTransferFrom(msg.sender, creator, amount);
        if (TOKEN.balanceOf(creator) - before != amount) revert UnexpectedTokenAmount();

        emit RequestPaid(id, creator, msg.sender, amount);
    }

    /// @notice Who paid a request and when. `paidAt == 0` means it has not been paid.
    function getPayment(bytes32 id) external view returns (address payer, uint256 amount, uint64 paidAt) {
        Payment storage p = _payments[id];
        return (p.payer, p.amount, p.paidAt);
    }
}
