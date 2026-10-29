import { useState } from "react"
import { Brand } from "@event-management/ui"
import { PublicCatalog } from "../PublicCatalog"
import { BookingList } from "./BookingList"

export function StaffWorkspace({ profile, onSignOut }: { profile: { displayName: string | null; email: string; staffRole: string | null }; onSignOut: () => void }) {
  const [view, setView] = useState<"bookings" | "packages" | "services">("bookings")
  return <div className="public-site"><header className="public-header"><Brand /><nav className="staff-nav" aria-label="Staff workspace">
    <button type="button" onClick={() => setView("bookings")}>Booking requests</button>
    <button type="button" onClick={() => setView("packages")}>Packages</button>
    <button type="button" onClick={() => setView("services")}>Services</button>
    <button type="button" onClick={onSignOut}>Sign out</button>
  </nav></header><main className="section">
    {view === "bookings" && <BookingList admin readOnly />}
    {view === "packages" && <><h1>Published packages</h1><PublicCatalog kind="packages" mode="overview" allowBooking={false} /></>}
    {view === "services" && <><h1>Published services</h1><PublicCatalog kind="services" mode="overview" allowBooking={false} /></>}
    <p>{profile.displayName ?? profile.email} · {profile.staffRole ?? "Staff"}</p>
  </main></div>
}
