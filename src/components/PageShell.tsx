import { motion } from 'framer-motion'
import { PayflowMark } from '@/components/PayflowLogo'
import { ACTIVE_ARC_CHAIN } from '@/config'

interface Props { children: React.ReactNode }

export default function PageShell({ children }: Props) {
  return (
    <div
      className="relative flex min-h-dvh items-start justify-center"
      style={{ background: 'var(--canvas)' }}
    >
      {/* Desktop: subtle dot-grid pattern behind the phone card */}
      <div
        className="pointer-events-none fixed inset-0 hidden md:block"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border-strong) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.45,
        }}
      />

      {/* Desktop: soft radial glow to lift the card */}
      <div
        className="pointer-events-none fixed inset-0 hidden md:block"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(20,97,166,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Wide desktop: product panel beside the app. Hidden below 1024px, so phones and tablets are unchanged. */}
      <aside
        className="relative z-10 hidden shrink-0 lg:sticky lg:top-10 lg:mr-14 lg:mt-10 lg:block lg:w-[340px] lg:self-start"
        aria-label="About Payflow"
      >
        <div className="flex items-center gap-2.5">
          <PayflowMark size={34} />
          <span className="display text-[20px] font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
            Payflow
          </span>
        </div>
        <h2 className="display mt-8 text-[34px] font-bold leading-[1.1]" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
          Send USDC.<br />We handle the chain.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
          Pay anyone on Arc from USDC on Ethereum, Base, Arbitrum, Avalanche or Optimism, or send directly on Arc.
          Non-custodial: you sign once, in your own wallet.
        </p>
        <ol className="mt-7 space-y-3.5">
          {[
            'Connect an EVM wallet',
            'Enter an amount and an Arc address',
            'Review the fee, sign, and get a receipt you can verify on Arc',
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-[14px]" style={{ color: 'var(--ink-2)' }}>
              <span
                className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--ink)' }}
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-2">
          {[ACTIVE_ARC_CHAIN.name, 'USDC only', 'Non-custodial'].map((tag) => (
            <span
              key={tag}
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-8 text-[12px]" style={{ color: 'var(--subtle)' }}>
          <a href="https://github.com/Siriron/payflow" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Source code</a>
          {' · '}
          <a href="https://github.com/Siriron/payflow/tree/main/docs" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Docs</a>
        </p>
      </aside>

      {/* Phone card — full-width on mobile, constrained on desktop */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 w-full md:my-10 md:max-w-[420px]"
        style={{ background: 'var(--canvas)' }}
      >
        <div
          className="min-h-dvh w-full md:min-h-[600px] md:rounded-[40px] md:overflow-hidden"
          style={{
            background: 'var(--canvas)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)',
          }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  )
}
