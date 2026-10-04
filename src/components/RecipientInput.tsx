import { useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { Clipboard, ClipboardCheck } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  error?: string | null
}

export default function RecipientInput({ value, onChange, error }: Props) {
  const checksummed = isAddress(value) ? getAddress(value) : null
  const [pasted, setPasted] = useState(false)

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      onChange(text.trim())
      setPasted(true)
      setTimeout(() => setPasted(false), 1800)
    } catch {
      // Clipboard permission denied — ignore silently
    }
  }

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

        {/* Valid badge OR paste button */}
        {checksummed ? (
          <span
            className="shrink-0 rounded-[7px] px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(26,128,71,0.10)', color: 'var(--success)' }}
          >
            Valid
          </span>
        ) : (
          <button
            type="button"
            onClick={() => { void handlePaste() }}
            aria-label="Paste address from clipboard"
            className="shrink-0 flex items-center gap-1 rounded-[9px] px-2 py-1 text-[11px] font-semibold transition-all active:scale-95"
            style={{
              background: pasted ? 'rgba(26,128,71,0.10)' : 'var(--surface-2)',
              color: pasted ? 'var(--success)' : 'var(--muted)',
              border: '1px solid var(--border)',
            }}
          >
            {pasted
              ? <ClipboardCheck className="size-3" />
              : <Clipboard className="size-3" />
            }
            <span>{pasted ? 'Pasted' : 'Paste'}</span>
          </button>
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
