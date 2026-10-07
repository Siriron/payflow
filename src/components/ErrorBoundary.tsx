import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { failed: boolean }

/** Last-resort screen if a page throws while rendering, instead of a blank page. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
        style={{ background: 'var(--canvas)', color: 'var(--ink)' }}
        role="alert"
      >
        <h1 className="display text-xl font-bold" style={{ letterSpacing: '-0.03em' }}>Something went wrong</h1>
        <p className="mt-2 max-w-[300px] text-sm" style={{ color: 'var(--subtle)' }}>
          Your funds are not affected. Reload the page to continue.
        </p>
        <button
          type="button"
          onClick={() => { window.location.assign('/') }}
          className="btn-primary mt-6"
          style={{ width: 'auto', paddingInline: '1.5rem' }}
        >
          Reload Payflow
        </button>
      </div>
    )
  }
}
