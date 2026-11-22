import type { NavKey } from "./navigation-types";

export const adminAiPaths = {
  knowledge: "/app/ai/knowledge",
  documents: "/app/ai/documents",
} as const;

export type AdminAiSection = keyof typeof adminAiPaths;

export function adminAiSection(path: string): AdminAiSection | null {
  const normalized = normalizePath(path);

  const found = (
    Object.entries(adminAiPaths) as [AdminAiSection, string][]
  ).find(([, href]) => href === normalized);

  return found?.[0] ?? null;
}

export const adminPaths: Record<NavKey, string> = {
  AI: adminAiPaths.knowledge,
  Overview: "/app/overview",
  Bookings: "/app/bookings",
  Messages: "/app/messages",
  Customers: "/app/users",
  Calendar: "/app/calendar",
  Packages: "/app/packages",
  Services: "/app/services",
  BusinessInformation: "/app/business-information",
  Inventory: "/app/inventory",
  Operations: "/app/operations",
  Reports: "/app/reports",
  Administration: "/app/settings",
};

export type CustomerTab =
  "Home" | "My events" | "Catalogs" | "Messages" | "Profile";

export const customerPaths: Record<CustomerTab, string> = {
  Home: "/app/home",
  "My events": "/app/events",
  Catalogs: "/app/catalogs",
  Messages: "/app/messages",
  Profile: "/app/settings",
};

export function adminKey(path: string) {
  if (adminBookingRequestId(path)) return "Bookings";

  if (adminAiSection(path)) return "AI";

  const found = (Object.entries(adminPaths) as [NavKey, string][]).find(
    ([, href]) => href === path,
  );

  return found?.[0] ?? null;
}

export function adminBookingRequestPath(id: string) {
  return `${adminPaths.Bookings}/${encodeURIComponent(id)}`;
}

export function adminBookingRequestId(path: string) {
  const match = /^\/app\/bookings\/([A-Za-z0-9_-]+)$/.exec(normalizePath(path));

  return match?.[1] ?? null;
}

export function customerTab(path: string): CustomerTab {
  if (path === "/app/packages") return "Catalogs";

  const found = (Object.entries(customerPaths) as [CustomerTab, string][]).find(
    ([, href]) => href === path,
  );

  return found?.[0] ?? "Home";
}

export function isSystemAdmin(profile: { role: string }) {
  return profile.role === "admin";
}

export function appHome(profile: { role: string }) {
  if (profile.role === "customer") return "/app/home";

  return "/app/overview";
}

export function allowedWorkspacePath(profile: { role: string }, path: string) {
  if (profile.role === "customer")
    return (
      path === "/app/packages" ||
      (Object.values(customerPaths) as string[]).includes(path)
    );

  return isSystemAdmin(profile) && adminKey(path) !== null;
}

// Login return paths remain local and must belong to the signed-in role.
export function workspaceReturnPath(
  profile: { role: string },
  value: string | null,
) {
  if (!value?.startsWith("/app/") || value.includes("\\")) return null;

  try {
    const url = new URL(value, "https://clemora.invalid");

    if (
      url.origin !== "https://clemora.invalid" ||
      !allowedWorkspacePath(profile, normalizePath(url.pathname))
    )
      return null;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);

  return path;
}
