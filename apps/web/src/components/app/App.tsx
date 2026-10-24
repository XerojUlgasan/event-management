import { useState } from "react"

import { packages } from "./data"
import type { EditablePackage } from "./data"
import type { Role, View } from "./types"
import { AppShell } from "./AppShell"
import { CustomerDashboard } from "./customer/CustomerDashboard"
import { DemoLogin } from "./DemoLogin"
import { PublicSite } from "./PublicSite"

export default function App() {
  const [view, setView] = useState<View>("public")
  const [demoRole, setDemoRole] = useState<Role>("Administrator")
  const [sharedPackages, setSharedPackages] = useState<EditablePackage[]>(
    packages.map((item, index) => ({
      ...item,
      inclusions:
        index === 0
          ? "Event coordination, venue setup, signature menu, service team"
          : "Planning guide, styled setup, selected menu, event support",
      status: index === 2 ? "Draft" : "Published",
    })),
  )

  const login = (role: "Customer" | Role) => {
    if (role === "Customer") {
      setView("customer")
      return
    }
    setDemoRole(role)
    setView("app")
  }

  if (view === "public") {
    return <PublicSite onEnterCustomer={() => setView("login")} />
  }
  if (view === "login") {
    return <DemoLogin onBack={() => setView("public")} onLogin={login} />
  }
  if (view === "customer") {
    return (
      <CustomerDashboard
        onPublic={() => setView("public")}
        onTeamPortal={() => setView("login")}
        packageRows={sharedPackages}
      />
    )
  }
  return (
    <AppShell
      onPublic={() => setView("public")}
      initialRole={demoRole}
      key={demoRole}
      packageRows={sharedPackages}
      setPackageRows={setSharedPackages}
    />
  )
}
