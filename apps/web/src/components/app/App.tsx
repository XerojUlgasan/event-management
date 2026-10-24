import { AppProvider, useSession, useView } from "./AppContext"
import { AppShell } from "./AppShell"
import { CustomerDashboard } from "./customer/CustomerDashboard"
import { DemoLogin } from "./DemoLogin"
import { PublicSite } from "./PublicSite"

function AppView() {
  const { view, goToLogin, goToPublic } = useView()
  const { login } = useSession()

  if (view === "public") {
    return <PublicSite onEnterCustomer={goToLogin} />
  }
  if (view === "login") {
    return <DemoLogin onBack={goToPublic} onLogin={login} />
  }
  if (view === "customer") {
    return <CustomerDashboard />
  }
  return <AppShell />
}

export default function App() {
  return (
    <AppProvider>
      <AppView />
    </AppProvider>
  )
}
