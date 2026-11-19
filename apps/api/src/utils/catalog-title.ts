import { catalogSlug } from "@event-management/contracts/catalog-slug";

export function catalogTitle(name: string) {
  const trimmed = name.trim();

  return { name: trimmed, slug: catalogSlug(trimmed) };
}

export function duplicateTitle(cause: unknown, message: string) {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505"
  ) {
    return { message, status: 409 as const };
  }

  return null;
}
