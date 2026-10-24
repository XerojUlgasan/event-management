import { useCallback, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { createContextFactory } from "./createContextFactory"
import { packages } from "./data"
import type { EditablePackage } from "./data"
import type { Role, View } from "./types"

type ViewContextValue = {
  view: View
  goToPublic: () => void
  goToLogin: () => void
}

type SessionContextValue = {
  role: Role
  login: (role: "Customer" | Role) => void
}

type PackagesContextValue = {
  packageRows: EditablePackage[]
  removePackage: (name: string) => void
  savePackage: (
    nextPackage: EditablePackage,
    originalName: string | null,
  ) => void
}

const [ViewProvider, useView] =
  createContextFactory<ViewContextValue>("View")
const [SessionProvider, useSession] =
  createContextFactory<SessionContextValue>("Session")
const [PackagesProvider, usePackages] =
  createContextFactory<PackagesContextValue>("Packages")

function createInitialPackages(): EditablePackage[] {
  return packages.map((item, index) => ({
    ...item,
    inclusions:
      index === 0
        ? "Event coordination, venue setup, signature menu, service team"
        : "Planning guide, styled setup, selected menu, event support",
    status: index === 2 ? "Draft" : "Published",
  }))
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("public")
  const [role, setRole] = useState<Role>("Administrator")
  const [packageRows, setPackageRows] = useState<EditablePackage[]>(
    createInitialPackages,
  )

  const goToPublic = useCallback(() => setView("public"), [])
  const goToLogin = useCallback(() => setView("login"), [])

  const login = useCallback((nextRole: "Customer" | Role) => {
    if (nextRole === "Customer") {
      setView("customer")
      return
    }
    setRole(nextRole)
    setView("app")
  }, [])

  const removePackage = useCallback((name: string) => {
    setPackageRows((rows) => rows.filter((row) => row.name !== name))
  }, [])

  const savePackage = useCallback(
    (nextPackage: EditablePackage, originalName: string | null) => {
      setPackageRows((rows) => {
        const existingIndex =
          originalName === null
            ? -1
            : rows.findIndex((row) => row.name === originalName)

        if (existingIndex === -1) return [...rows, nextPackage]

        return rows.map((row, index) =>
          index === existingIndex ? nextPackage : row,
        )
      })
    },
    [],
  )

  const viewValue = useMemo<ViewContextValue>(
    () => ({ view, goToPublic, goToLogin }),
    [view, goToPublic, goToLogin],
  )
  const sessionValue = useMemo<SessionContextValue>(
    () => ({ role, login }),
    [role, login],
  )
  const packagesValue = useMemo<PackagesContextValue>(
    () => ({ packageRows, removePackage, savePackage }),
    [packageRows, removePackage, savePackage],
  )

  return (
    <ViewProvider value={viewValue}>
      <SessionProvider value={sessionValue}>
        <PackagesProvider value={packagesValue}>
          {children}
        </PackagesProvider>
      </SessionProvider>
    </ViewProvider>
  )
}

export { usePackages, useSession, useView }
