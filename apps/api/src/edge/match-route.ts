export const routeFamilies = [
  { id: "guest-chat", prefixes: ["/v1/guest"] },
  { id: "ai", prefixes: ["/v1/admin/ai/knowledge"] },
  { id: "health", prefixes: ["/v1/health"] },
  {
    id: "catalog-media",
    prefixes: ["/v1/admin/catalog-media", "/v1/catalog-media"],
  },
  { id: "services", prefixes: ["/v1/admin/services", "/v1/services"] },
  { id: "packages", prefixes: ["/v1/admin/packages", "/v1/packages"] },
  {
    id: "booking-requests",
    prefixes: [
      "/v1/admin/booking-requests",
      "/v1/booking-requests",
      "/v1/quotations",
    ],
  },
  {
    id: "event-days",
    prefixes: ["/v1/admin/event-days"],
  },
  { id: "message-images", prefixes: ["/v1/message-images"] },
  { id: "messages", prefixes: ["/v1/admin/conversations", "/v1/messages"] },
  { id: "auth", prefixes: ["/v1/auth", "/v1/me"] },
  { id: "users", prefixes: ["/v1/admin/users"] },
] as const;

export type RouteFamilyId = (typeof routeFamilies)[number]["id"];

const prefixes = routeFamilies
  .flatMap((family) =>
    family.prefixes.map((prefix) => ({ id: family.id, prefix })),
  )
  .sort((left, right) => right.prefix.length - left.prefix.length);

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function matchRouteFamily(pathname: string): RouteFamilyId | null {
  return (
    prefixes.find((entry) => matchesPrefix(pathname, entry.prefix))?.id ?? null
  );
}
