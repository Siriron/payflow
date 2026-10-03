import { useNavigate } from 'react-router-dom'
import type { PaymentIntent } from '@/lib/intent'

export function useNavigateToResume() {
  const navigate = useNavigate()
  return (intent: PaymentIntent) => {
    void navigate('/progress', { state: { intentId: intent.id, resuming: true } })
  }
}
