import { getAddress, isAddress } from 'viem'

interface Props {
  value: string
  onChange: (v: string) => void
  error?: string | null
}

export default function RecipientInput({ value, onChange, error }: Props) {
  const checksummed = isAddress(value) ? getAddress(value) : null

  return (
    <div>
      <label
        htmlFor="recipient"
        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.09em]"
        style={{ color: 'var(--muted)' }}
      >
        Recipient
      </label>
      <div
        className="glass-inner flex items-center gap-3 rounded-[16px] px-4 py-3.5"
        style={
          error
            ? { border: '1.5px solid var(--danger)' }
            : checksummed
            ? { border: '1.5px solid rgba(26,128,71,0.30)' }
            : { border: '1px solid var(--border)' }
        }
      >
        <input
          id="recipient"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="0x…"
          className="mono min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-25"
          style={{ color: 'var(--ink)' }}
          aria-label="Recipient wallet address"
          aria-invalid={!!error}
          aria-describedby={error ? 'recipient-error' : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {checksummed && (
          <span
            className="shrink-0 rounded-[7px] px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(26,128,71,0.10)', color: 'var(--success)' }}
          >
            Valid
          </span>
        )}
      </div>
      {error && (
        <p id="recipient-error" className="mt-1.5 px-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
