export type Profile = {
  id: string;
  firebaseUid: string | null;
  hasPassword: boolean;
  email: string;
  displayName: string | null;
  role: "admin" | "staff" | "customer";
  staffRole: string | null;
  createdAt: string;
  updatedAt: string;
};

const apiUrl = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  body?: unknown,
  idToken?: string,
  method?: "GET" | "POST" | "PATCH" | "DELETE",
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string | { issues?: { path?: (string | number)[]; message?: string }[] };
    };
    throw new ApiError(
      typeof result.error === "string"
        ? result.error
        : typeof result.error === "object" && result.error?.issues?.length
          ? result.error.issues.map(issue => `${issue.path?.join(".") || "Field"}: ${issue.message || "invalid value"}`).join("; ")
          : "Please check the form and try again.",
      response.status,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export const syncSession = (idToken: string) =>
  request<Profile>("/auth/sync", {}, idToken);
export const getMe = () => request<Profile>("/me");
export const endSession = () => request<void>("/auth/logout", {});
export const login = (email: string, password: string) =>
  request<Profile>("/auth/login", { email, password });
export const register = (
  displayName: string,
  email: string,
  password: string,
) => request<Profile>("/auth/register", { displayName, email, password });
export const linkFirebase = (idToken: string, currentPassword: string) =>
  request<Profile>("/auth/link/firebase", { currentPassword }, idToken);
export const addPassword = (idToken: string, password: string) =>
  request<Profile>("/auth/password", { password }, idToken);

export type PackagePrice = { kind: "fixed"; currency: "PHP"; amountMinor: number }
export type ServiceContent = { name: string; categories: string[]; description: string; imageUrl: string | null }
export type ServiceVersion = ServiceContent & { id: string; serviceId: string; version: number; state: "draft" | "published" | "superseded"; updatedAt: string; publishedAt: string | null }
export type PublicService = ServiceContent & { id: string; versionId: string; version: number; publishedAt: string }
export type AdminService = { id: string; archivedAt: string | null; draft: ServiceVersion | null; published: ServiceVersion | null; versions?: ServiceVersion[] }
export type PackageServiceInput = { serviceVersionId: string; role: "included" | "add_on"; includedQuantity: number | null; addOnPrice: PackagePrice | null; addOnMaxQuantity: number | null }
export type PackageService = PackageServiceInput & { id: string; service: ServiceVersion }
export type PackageContent = {
  name: string; eventTypes: string[]; description: string; guestMin: number; guestMax: number;
  venueDetails: string; inclusions: string[]; exclusions: string[]; terms: string;
  imageUrl: string | null; price: PackagePrice | null; services?: PackageServiceInput[]
}
export type PackageVersion = PackageContent & {
  id: string; packageId: string; version: number; state: "draft" | "published" | "superseded";
  updatedAt: string; publishedAt: string | null; services?: PackageService[]
}
export type PublicPackage = PackageContent & { id: string; versionId: string; version: number; publishedAt: string; services?: PackageService[] }
export type AdminPackage = { id: string; archivedAt: string | null; draft: PackageVersion | null; published: PackageVersion | null; versions?: PackageVersion[] }

function pageQuery(page?: { limit: number; offset?: number }) {
  return page ? `?limit=${page.limit}&offset=${page.offset ?? 0}` : ""
}
export const getPackages = (page?: { limit: number; offset?: number }) => request<{ packages: PublicPackage[]; nextOffset: number | null }>(`/packages${pageQuery(page)}`)
export const getPackage = (id: string) => request<PublicPackage>(`/packages/${encodeURIComponent(id)}`)
export const getAdminPackages = () => request<{ packages: AdminPackage[] }>("/admin/packages")
export const getAdminPackage = (id: string) => request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}`)
export const createPackage = (content: PackageContent) => request<AdminPackage>("/admin/packages", content)
export const updatePackageDraft = (id: string, content: PackageContent, expectedUpdatedAt: string) =>
  request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}/draft`, { ...content, expectedUpdatedAt }, undefined, "PATCH")
export const publishPackage = (id: string, expectedUpdatedAt: string) => request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}/publish`, { expectedUpdatedAt })
export const archivePackage = (id: string) => request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}/archive`, {})
export const deletePackage = (id: string) => request<void>(`/admin/packages/${encodeURIComponent(id)}`, undefined, undefined, "DELETE")

export const getAdminServices = () => request<{ services: AdminService[] }>("/admin/services")
export const getServices = (page?: { limit: number; offset?: number }) => request<{ services: PublicService[]; nextOffset: number | null }>(`/services${pageQuery(page)}`)
export const getService = (id: string) => request<PublicService>(`/services/${encodeURIComponent(id)}`)
export const getIncludingPackages = (id: string) => request<{ packages: PublicPackage[] }>(`/services/${encodeURIComponent(id)}/packages`)
export const getAdminService = (id: string) => request<AdminService>(`/admin/services/${encodeURIComponent(id)}`)
export const createService = (content: ServiceContent) => request<AdminService>("/admin/services", content)
export const updateServiceDraft = (id: string, content: ServiceContent, expectedUpdatedAt: string) => request<AdminService>(`/admin/services/${encodeURIComponent(id)}/draft`, { ...content, expectedUpdatedAt }, undefined, "PATCH")
export const publishService = (id: string, expectedUpdatedAt: string) => request<AdminService>(`/admin/services/${encodeURIComponent(id)}/publish`, { expectedUpdatedAt })
export const archiveService = (id: string) => request<AdminService>(`/admin/services/${encodeURIComponent(id)}/archive`, {})
export const deleteService = (id: string) => request<void>(`/admin/services/${encodeURIComponent(id)}`, undefined, undefined, "DELETE")

// Uploaded images use API-relative paths; resolve them against the API origin.
export function packageImageSrc(imageUrl: string | null): string | undefined {
  if (!imageUrl) return undefined
  return imageUrl.startsWith("/v1/package-images/") ? new URL(imageUrl, new URL(apiUrl, window.location.origin)).href : imageUrl
}

export async function uploadPackageImage(file: File): Promise<string> {
  const body = new FormData()
  body.append("image", file)
  const response = await fetch(`${apiUrl}/admin/package-images`, { method: "POST", credentials: "include", body })
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string }
    throw new ApiError(typeof result.error === "string" ? result.error : "Unable to upload image. Please try again.", response.status)
  }
  return ((await response.json()) as { imageUrl: string }).imageUrl
}

export function deleteUnreferencedPackageImage(imageUrl: string): Promise<void> {
  const id = imageUrl.match(/^\/v1\/package-images\/([0-9a-f-]+)$/i)?.[1]
  if (!id) throw new Error("Unable to identify the uploaded image for cleanup.")
  return request<void>(`/admin/package-images/${encodeURIComponent(id)}`, undefined, undefined, "DELETE")
}

export function serviceImageSrc(imageUrl: string | null): string | undefined {
  if (!imageUrl) return undefined
  return imageUrl.startsWith("/v1/service-images/") ? new URL(imageUrl, new URL(apiUrl, window.location.origin)).href : imageUrl
}

export async function uploadServiceImage(file: File): Promise<string> {
  const body = new FormData()
  body.append("image", file)
  const response = await fetch(`${apiUrl}/admin/service-images`, { method: "POST", credentials: "include", body })
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string }
    throw new ApiError(typeof result.error === "string" ? result.error : "Unable to upload image. Please try again.", response.status)
  }
  return ((await response.json()) as { imageUrl: string }).imageUrl
}

export function deleteUnreferencedServiceImage(imageUrl: string): Promise<void> {
  const id = imageUrl.match(/^\/v1\/service-images\/([0-9a-f-]+)$/i)?.[1]
  if (!id) throw new Error("Unable to identify the uploaded image for cleanup.")
  return request<void>(`/admin/service-images/${encodeURIComponent(id)}`, undefined, undefined, "DELETE")
}

export type ChatMessage = {
  id: string
  body: string
  senderId: string
  senderRole: "admin" | "customer"
  senderName: string
  createdAt: string
  readAt: string | null
}

export type ChatConversation = {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  lastMessage: ChatMessage | null
  unreadCount: number
  updatedAt: string
}

export type ChatThread = {
  conversation: ChatConversation
  messages: ChatMessage[]
}

export type AdminUser = {
  id: string
  displayName: string | null
  email: string
  role: "admin" | "staff" | "customer"
  staffRole: string | null
  createdAt: string
}

export const getAdminUsers = () =>
  request<{ staff: AdminUser[]; customers: AdminUser[] }>("/admin/users")

export const getMyConversation = () => request<ChatThread>("/messages/conversation")
export const sendMyMessage = (body: string) =>
  request<{ message: ChatMessage }>("/messages/conversation/messages", { body })
export const getAdminConversations = () =>
  request<{ conversations: ChatConversation[] }>("/admin/conversations")
export const getAdminConversation = (id: string) =>
  request<ChatThread>(`/admin/conversations/${encodeURIComponent(id)}`)
export const sendAdminMessage = (id: string, body: string) =>
  request<{ message: ChatMessage }>(`/admin/conversations/${encodeURIComponent(id)}/messages`, { body })

export type BookingStatus = "under_review" | "needs_details" | "accepted" | "declined" | "cancelled"
export type BookingRequestInput = { packageId: string; packageVersionId: string; eventType: string; startsAt: string; endsAt: string; timeZone: string; guestCount: number; contactName: string; phoneNumber: string; preferredVenueLocation: string; specialRequests: string }
export type BookingRequest = Omit<BookingRequestInput, "specialRequests"> & { specialRequests: string | null; id: string; reference: string; customerId: string; packageName: string; status: BookingStatus; outOfRange: boolean; createdAt: string; updatedAt: string; statusHistory: { status: BookingStatus; reason: string | null; changedBy: string; createdAt: string }[] }
export const createBookingRequest = (body: BookingRequestInput) => request<{ bookingRequest: BookingRequest }>("/booking-requests", body)
export const getMyBookingRequests = () => request<{ bookingRequests: BookingRequest[] }>("/booking-requests/mine")
export const getAdminBookingRequests = () => request<{ bookingRequests: BookingRequest[] }>("/admin/booking-requests")
export const updateBookingRequestStatus = (id: string, status: BookingStatus, reason?: string) => request<{ bookingRequest: BookingRequest }>(`/admin/booking-requests/${encodeURIComponent(id)}/status`, { status, ...(reason ? { reason } : {}) }, undefined, "PATCH")

export const cancelMyBookingRequest = (id: string, reason: string) => request<{ bookingRequest: BookingRequest }>(`/booking-requests/${encodeURIComponent(id)}/cancel`, { reason }, undefined, "PATCH")
