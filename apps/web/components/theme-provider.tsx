'use client'

import * as React from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'tuturai-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

let storedTheme: Theme | null = null
const themeListeners = new Set<() => void>()

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getThemeSnapshot(): Theme {
  if (storedTheme === null) {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    storedTheme = isTheme(stored) ? stored : 'light'
  }
  return storedTheme
}

function getThemeServerSnapshot(): Theme {
  return 'light'
}

function subscribeTheme(onChange: () => void) {
  themeListeners.add(onChange)
  return () => {
    themeListeners.delete(onChange)
  }
}

function writeTheme(next: Theme) {
  storedTheme = next
  window.localStorage.setItem(STORAGE_KEY, next)
  themeListeners.forEach((listener) => listener())
}

function subscribeSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function getSystemThemeServerSnapshot(): ResolvedTheme {
  return 'light'
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  enableSystem?: boolean
  attribute?: string
  disableTransitionOnChange?: boolean
}) {
  const theme = React.useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  )
  const systemTheme = React.useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot,
  )

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme: writeTheme }),
    [theme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
