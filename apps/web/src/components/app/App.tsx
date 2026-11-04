import { useEffect, useState } from "react"
import { Brand } from "@event-management/ui"

import { AuthProvider, useAuth } from "../../lib/auth"
import type { View } from "./types"
import { AppShell } from "./AppShell"
import { AuthPage } from "./AuthPage"
import { CustomerDashboard } from "./customer/CustomerDashboard"
import { BookingRequestDialog, clearBookingDraft, readBookingDraft } from "./BookingRequest"
import { StaffWorkspaceShell } from "./staff/StaffWorkspaceShell"
import { PublicSite } from "./PublicSite"

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function AppContent() {
  const { status, profile, signOut } = useAuth()
  const [view, setView] = useState<View>(() => new URLSearchParams(window.location.search).get("booking") === "resume" ? "login" : "public")
  const [draft, setDraft] = useState(() => new URLSearchParams(window.location.search).get("booking") === "resume" ? readBookingDraft() : null)

  useEffect(() => {
    if (status === "signed-in" && profile) {
      setView(profile.role !== "customer" ? "app" : "customer")
    }
  }, [status, profile])

  const handleSignOut = async () => {
    try {
      await signOut()
      setView("login")
    } catch {
      // Keep the current account visible until the API confirms logout.
    }
  }

  if (status === "loading") {
    return (
      <div className="auth-splash">
        <Brand />
        <span>Loading your workspace…</span>
      </div>
    )
  }

  if (status === "signed-in" && profile) {
    const displayName = profile.displayName ?? profile.email

    if (view === "login" || view === "app" || view === "customer") {
      if (profile.role === "staff" || (profile.role === "admin" && profile.staffRole !== "System Administrator")) return <StaffWorkspaceShell profile={profile} onSignOut={handleSignOut} />
      if (profile.role === "admin") {
        return (
          <AppShell
            profile={profile}
            onSignOut={handleSignOut}
          />
        )
      }

      return (
        <> <CustomerDashboard
          onPublic={() => setView("public")}
          userName={displayName}
          userEmail={profile.email}
          onSignOut={handleSignOut}
        />{draft && <BookingRequestDialog item={draft.item} resume onClose={() => { setDraft(null); window.history.replaceState({}, "", "/") }} />}</>
      )
    }
  }

  if (view === "login" || view === "app" || view === "customer") {
    return <AuthPage onBack={() => { clearBookingDraft(); setDraft(null); window.history.replaceState({}, "", "/"); setView("public") }} />
  }

  return <PublicSite onEnterCustomer={() => setView("login")} />
}
