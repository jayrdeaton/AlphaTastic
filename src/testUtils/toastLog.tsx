import { useToast } from '@rific/toaster'
import { useEffect } from 'react'

// Every toast sent while <ToastLog /> is mounted (inside the test's Providers), oldest first. The app's
// Toaster shows one toast at a time (limit 1, Jay 2026-11-20): only the newest is on screen, so a round that
// unlocks several shows just the last, and a test reads the rest from here.
export type SentToast = { title: string; caption: string | null }

let sent: SentToast[] = []

export const ToastLog = (): null => {
  const { history } = useToast()
  useEffect(() => {
    // The provider's history is newest first.
    sent = [...history].reverse().map(({ title, caption }) => ({ title: title ?? '', caption }))
  }, [history])
  return null
}

export const sentToasts = (): SentToast[] => sent
