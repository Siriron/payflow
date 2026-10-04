import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAccount, useSwitchChain, useConfig } from 'wagmi'
import { isAddress } from 'viem'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import PageShell from '@/components/PageShell'
import AmountInput from '@/components/AmountInput'
import RecipientInput from '@/components/RecipientInput'
import { ACTIVE_ARC_CHAIN, CCTP_SOURCE_CHAINS } from '@/config'
import { getKitChainName, CHAIN_ID_TO_KIT_NAME } from '@/lib/kit'
import { createIntent, saveIntent, loadAllIntents } from '@/lib/intent'

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export default function Send() {
  const navigate = useNavigate()
  const location = useLocation()
  const { address, chainId: walletChainId, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const wagmiConfig = useConfig()

  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [recipientError, setRecipientError] = useState<string | null>(null)

  // Pre-selected source chain from ChainBalanceSheet navigation
  const preselectedChainId = (location.state as { sourceChainId?: number } | null)?.sourceChainId

  // If a chain was pre-selected and wallet is not already on it, switch
  useEffect(() => {
    if (!preselectedChainId || walletChainId === preselectedChainId) return
    void switchChainAsync({ chainId: preselectedChainId }).catch(() => { /* user rejected */ })
  // Only run once on mount when preselectedChainId is set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedChainId])

  // Purge orphaned draft intents when returning from Review
  useEffect(() => {
    if (!address) return
    try {
      const all = loadAllIntents()
      const cleaned = all.filter(
        (i) => !(i.payer.toLowerCase() === address.toLowerCase() && i.state === 'draft'),
      )
      if (cleaned.length !== all.length) {
        localStorage.setItem('payflow:intents', JSON.stringify(cleaned))
      }
    } catch { /* never crash on localStorage error */ }
  }, [address])

  const sourceChainId = walletChainId
  const sourceChainName = sourceChainId
    ? (wagmiConfig.chains.find((c) => c.id === sourceChainId)?.name ?? null)
    : null
  const kitChainName = sourceChainId ? getKitChainName(sourceChainId) : null

  const supportedChainIds: number[] = CCTP_SOURCE_CHAINS.map((c) => c.id)
  const isSourceSupported =
    sourceChainId !== undefined &&
    supportedChainIds.includes(sourceChainId) &&
    kitChainName !== null

  const isValidAmount = (v: string): boolean => {
    if (!v || v === '.') return false
    const n = Number(v)
    return Number.isFinite(n) && n >= 0.01
  }

  const validate = (): boolean => {
    let valid = true
    if (!isValidAmount(amount)) {
      setAmountError('Enter an amount (minimum 0.01 USDC).')
      valid = false
    } else {
      setAmountError(null)
    }
    if (!recipient || !isAddress(recipient)) {
      setRecipientError('Check the wallet address.')
      valid = false
    } else {
      setRecipientError(null)
    }
    return valid
  }

  const handleReview = async () => {
    if (!validate()) return
    if (!address || !sourceChainId) return
    if (!kitChainName) { setAmountError('Route unavailable.'); return }

    if (!isSourceSupported) {
      try { await switchChainAsync({ chainId: ACTIVE_ARC_CHAIN.id }) }
      catch { return }
    }

    const intent = createIntent({
      payer: address,
      recipient,
      amount,
      sourceChain: kitChainName,
      sourceChainId,
      destinationChain: CHAIN_ID_TO_KIT_NAME[ACTIVE_ARC_CHAIN.id] ?? 'Arc',
    })
    saveIntent(intent)
    void navigate('/review', { state: { intentId: intent.id } })
  }

  useEffect(() => {
    if (!isConnected) { void navigate('/') }
  }, [isConnected, navigate])

  if (!isConnected) return null

  const canProceed = isSourceSupported && isValidAmount(amount) && isAddress(recipient)

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col px-5 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:min-h-0 md:pb-8">

        {/* Header */}
        <motion.div {...fadeUp} className="mb-7 flex items-center gap-3">
          <button
            type="button"
            onClick={() => { void navigate('/') }}
            className="glass flex items-center gap-1.5 rounded-[14px] px-3 py-2.5 transition-all active:scale-95"
            aria-label="Back to home"
          >
            <ChevronLeft className="size-4" style={{ color: 'var(--ink)' }} />
            <span className="hidden text-[13px] font-semibold md:block" style={{ color: 'var(--ink)' }}>Back</span>
          </button>
          <div>
            <h1
              className="display text-xl font-bold"
              style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
            >
              Send
            </h1>
            {sourceChainName && (
              <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                from {sourceChainName}
              </p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07, duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-1 flex-col gap-4"
        >
          {/* Unsupported chain */}
          {!isSourceSupported && sourceChainName && (
            <div
              className="rounded-[14px] px-4 py-3 text-sm font-medium"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
              role="alert"
            >
              Route unavailable from {sourceChainName}. Switch to a supported chain.
            </div>
          )}

          {/* Amount */}
          <AmountInput
            value={amount}
            onChange={setAmount}
            balanceChainId={sourceChainId}
            error={amountError}
          />

          {/* Recipient */}
          <RecipientInput
            value={recipient}
            onChange={setRecipient}
            error={recipientError}
          />

          {/* Route hint — small, not competing */}
          <p className="text-[12px] text-center" style={{ color: 'var(--subtle)' }}>
            Settles on Arc. We'll handle the route.
          </p>

          {/* CTA — pushed to bottom */}
          <div className="mt-auto pt-2">
            <button
              type="button"
              onClick={() => { void handleReview() }}
              disabled={!canProceed}
              className="btn-primary"
            >
              Review payment
            </button>
          </div>
        </motion.div>
      </div>
    </PageShell>
  )
}
