import type { NavKey } from "./types"

export const adminPaths: Record<NavKey, string> = {
  Overview: "/app/overview",
  Bookings: "/app/bookings",
  Messages: "/app/messages",
  StaffCustomers: "/app/users",
  Calendar: "/app/calendar",
  Packages: "/app/packages",
  Services: "/app/services",
  Venues: "/app/venues",
  Inventory: "/app/inventory",
  Operations: "/app/operations",
  Reports: "/app/reports",
  Administration: "/app/settings",
}

export type CustomerTab = "Home" | "My events" | "Packages" | "Messages" | "Profile"

export const customerPaths: Record<CustomerTab, string> = {
  Home: "/app/home",
  "My events": "/app/events",
  Packages: "/app/packages",
  Messages: "/app/messages",
  Profile: "/app/settings",
}

export function adminKey(path: string) {
  const found = (Object.entries(adminPaths) as [NavKey, string][]).find(([, href]) => href === path)
  return found?.[0] ?? null
}

export function customerTab(path: string): CustomerTab {
  const found = (Object.entries(customerPaths) as [CustomerTab, string][]).find(([, href]) => href === path)
  return found?.[0] ?? "Home"
}

export function isSystemAdmin(profile: { role: string; staffRole: string | null }) {
  return profile.role === "admin" && profile.staffRole === "System Administrator"
}

export function isStaffWorkspace(profile: { role: string; staffRole: string | null }) {
  return profile.role === "staff" || (profile.role === "admin" && profile.staffRole !== "System Administrator")
}

export function appHome(profile: { role: string; staffRole: string | null }) {
  if (profile.role === "customer") return "/app/home"
  if (isStaffWorkspace(profile)) return "/app/events"
  return "/app/overview"
}

export function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1)
  return path
}
