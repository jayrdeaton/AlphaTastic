import { useEffect } from 'react'
import { Platform } from 'react-native'

// A computer's keyboard on the web: letters and Backspace, unless a browser shortcut is being typed.
export const usePhysicalKeys = (enabled: boolean, onLetter: (letter: string) => void, onBackspace: () => void): void => {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Backspace') {
        event.preventDefault()
        onBackspace()
      } else if (/^[a-z]$/i.test(event.key)) onLetter(event.key.toUpperCase())
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [enabled, onLetter, onBackspace])
}
