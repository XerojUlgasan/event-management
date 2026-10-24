import { createContext, useContext } from "react"
import type { ReactNode } from "react"

const MISSING = Symbol("context-missing")

/**
 * Creates a typed context, its provider, and a hook that throws when the hook
 * is used outside the provider.
 *
 * @example
 * const [ThemeProvider, useTheme] = createContextFactory<Theme>("Theme")
 */
export function createContextFactory<T>(name: string) {
  const Context = createContext<T | typeof MISSING>(MISSING)
  Context.displayName = name

  function Provider({ value, children }: { value: T; children: ReactNode }) {
    return <Context.Provider value={value}>{children}</Context.Provider>
  }
  Provider.displayName = `${name}Provider`

  function useContextValue() {
    const value = useContext(Context)
    if (value === MISSING) {
      throw new Error(
        `${name} context was used outside of <${name}Provider>.`,
      )
    }
    return value
  }

  return [Provider, useContextValue] as const
}
