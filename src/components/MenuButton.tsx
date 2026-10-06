import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, History, Link2 } from 'lucide-react'

interface MenuItem {
  label: string
  hint: string
  to: string
  icon: typeof History
}

const ITEMS: MenuItem[] = [
  { label: 'Activity', hint: 'Payments from this browser', to: '/activity', icon: History },
  { label: 'Request payment', hint: 'Create a payment link', to: '/request/new', icon: Link2 },
]

/** Small header menu. Opens a panel with links to the app's other screens. */
export default function MenuButton() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside tap or Escape
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full transition-colors"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border-strong)',
          color: 'var(--muted)',
        }}
      >
        <Menu className="size-4" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[230px] overflow-hidden rounded-[18px] p-1.5"
            style={{
              background: 'var(--surface-high)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              transformOrigin: 'top left',
            }}
          >
            {ITEMS.map(({ label, hint, to, icon: Icon }) => (
              <button
                key={to}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); void navigate(to) }}
                className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:opacity-80"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <Icon className="size-4" style={{ color: 'var(--ink-2)' }} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{label}</span>
                  <span className="block truncate text-[11px]" style={{ color: 'var(--subtle)' }}>{hint}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
