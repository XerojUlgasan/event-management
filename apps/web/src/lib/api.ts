import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests"

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
      ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
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
export type ServiceContent = { name: string; description: string; hourlyRatePesos: number | null }
export type ServiceVersion = ServiceContent & { imageId: string | null; id: string; serviceId: string; version: number; state: "draft" | "published" | "superseded"; updatedAt: string; publishedAt: string | null }
export type PublicService = ServiceContent & { imageId: string | null; id: string; versionId: string; version: number; publishedAt: string }
export type AdminService = { id: string; archivedAt: string | null; draft: ServiceVersion | null; published: ServiceVersion | null; versions?: ServiceVersion[] }
export type PackageServiceInput = { serviceVersionId: string; role: "included" | "add_on"; includedQuantity: number | null; addOnPrice: PackagePrice | null; addOnMaxQuantity: number | null }
export type PackageService = PackageServiceInput & { id: string; service: ServiceVersion }
export type PackageContent = {
  name: string; eventTypes: string[]; description: string; guestMax: number;
  inclusions: string[]; exclusions: string[];
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
export const updateServiceDraft = (id: string, content: ServiceContent, expectedUpdatedAt: string, removeImage = false) => request<AdminService>(`/admin/services/${encodeURIComponent(id)}/draft`, { ...content, expectedUpdatedAt, ...(removeImage ? { removeImage } : {}) }, undefined, "PATCH")
export const uploadService = (content: ServiceContent, image: File, id?: string, expectedUpdatedAt?: string) => {
  const body = new FormData()
  body.set("content", JSON.stringify({ ...content, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) }))
  body.set("image", image)
  return request<AdminService>(id ? `/admin/service-uploads/${encodeURIComponent(id)}` : "/admin/service-uploads", body, undefined, id ? "PATCH" : "POST")
}
export const publishService = (id: string, expectedUpdatedAt: string) => request<AdminService>(`/admin/services/${encodeURIComponent(id)}/publish`, { expectedUpdatedAt })
export const archiveService = (id: string) => request<AdminService>(`/admin/services/${encodeURIComponent(id)}/archive`, {})
export const deleteService = (id: string) => request<void>(`/admin/services/${encodeURIComponent(id)}`, undefined, undefined, "DELETE")

export const packageImageSrc = (imageUrl: string | null): string | undefined => imageUrl || undefined
export const serviceImageSrc = (imageId: string | null): string | undefined => imageId ? `${apiUrl}/service-images/${encodeURIComponent(imageId)}` : undefined

export type ConversationStatus = "active" | "closed"

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
  packageId: string | null
  packageName: string | null
  bookingRequestId: string | null
  bookingRequestReference: string | null
  eventType: string | null
  eventStartsAt: string | null
  eventEndsAt: string | null
  guestCount: number | null
  status: ConversationStatus
  closedAt: string | null
  expiresAt: string
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

export type VenueContent = { name: string; location: string; description: string; categories: string[]; capacityMax: number | null; imageUrls: string[] }
export type VenueVersion = VenueContent & { id: string; venueId: string; version: number; state: "draft" | "published" | "superseded"; updatedAt: string; publishedAt: string | null }
export type Venue = VenueContent & { id: string; versionId: string; version: number; publishedAt: string; createdAt: string; updatedAt: string; archivedAt: null }
export type AdminVenue = { id: string; archivedAt: string | null; draft: VenueVersion | null; published: VenueVersion | null; versions?: VenueVersion[] }
export const getVenues = (page?: { limit: number; offset?: number }) => request<{ venues: Venue[]; nextOffset: number | null }>(`/venues${pageQuery(page)}`)
export const getAdminVenues = () => request<{ venues: AdminVenue[] }>("/admin/venues")
export const getAdminVenue = (id: string) => request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}`)
export const createVenue = (content: VenueContent) => request<AdminVenue>("/admin/venues", content)
export const updateVenueDraft = (id: string, content: VenueContent, expectedUpdatedAt: string) => request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}/draft`, { ...content, expectedUpdatedAt }, undefined, "PATCH")
export const publishVenue = (id: string, expectedUpdatedAt: string) => request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}/publish`, { expectedUpdatedAt })
export const archiveVenue = (id: string) => request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}/archive`, {})
export const deleteVenue = (id: string) => request<void>(`/admin/venues/${encodeURIComponent(id)}/draft`, undefined, undefined, "DELETE")
export const venueImageSrc = (imageUrl: string): string => imageUrl

export const getMyConversation = () => request<ChatThread>("/messages/conversation")
export const createMyConversation = () => request<ChatThread>("/messages/conversations", {})
export const getMyConversations = () => request<{ conversations: ChatConversation[] }>("/messages/conversations")
export const getMyConversationById = (id: string) => request<ChatThread>(`/messages/conversations/${encodeURIComponent(id)}`)
export const sendMyMessage = (body: string, conversationId?: string) =>
  request<{ message: ChatMessage }>("/messages/conversation/messages", { body, conversationId })
export const getAdminConversations = (cursor?: string) =>
  request<{ conversations: ChatConversation[]; nextCursor: string | null }>(
    `/admin/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  )
export const getAdminConversation = (id: string) =>
  request<ChatThread>(`/admin/conversations/${encodeURIComponent(id)}`)
export const sendAdminMessage = (id: string, body: string) =>
  request<{ message: ChatMessage }>(`/admin/conversations/${encodeURIComponent(id)}/messages`, { body })

export type BookingStatus = "under_review" | "needs_details" | "accepted" | "declined" | "cancelled"
export type BookingRequestInput = { packageId: string; packageVersionId: string; eventType: string; preferredDate: string; estimatedDuration: BookingEstimatedDuration; estimatedDurationDays?: number; timeZone: string; contactName: string; phoneNumber: string; specialRequests?: string }
export type BookingRequest = Omit<BookingRequestInput, "specialRequests" | "preferredDate" | "estimatedDuration" | "estimatedDurationDays"> & { preferredDate: string | null; estimatedDuration: BookingEstimatedDuration | null; estimatedDurationDays: number | null; guestCount: number | null; startsAt: string | null; endsAt: string | null; preferredVenueLocation: string | null; specialRequests: string | null; id: string; reference: string; customerId: string; packageName: string; status: BookingStatus; outOfRange: boolean; createdAt: string; updatedAt: string; statusHistory: { status: BookingStatus; reason: string | null; changedBy: string; createdAt: string }[] }
export const createBookingRequest = (body: BookingRequestInput) => request<{ bookingRequest: BookingRequest }>("/booking-requests", body)
export const getMyBookingRequests = () => request<{ bookingRequests: BookingRequest[] }>("/booking-requests/mine")
export const getMyBookingRequest = (id: string) => request<{ bookingRequest: BookingRequest }>(`/booking-requests/${encodeURIComponent(id)}`)
export const getAdminBookingRequest = (id: string) => request<{ bookingRequest: BookingRequest }>(`/admin/booking-requests/${encodeURIComponent(id)}`)
export const getAdminBookingRequests = () => request<{ bookingRequests: BookingRequest[] }>("/admin/booking-requests")
export type BookingRequestFilters = { status?: BookingStatus; preferredDate?: string; cursor?: string; limit: number }
export const getAdminBookingRequestsPage = (filters: BookingRequestFilters) => {
  const query = new URLSearchParams({ limit: String(filters.limit) })
  if (filters.status) query.set("status", filters.status)
  if (filters.preferredDate) query.set("preferredDate", filters.preferredDate)
  if (filters.cursor) query.set("cursor", filters.cursor)
  return request<{ bookingRequests: BookingRequest[]; nextCursor: string | null }>(`/admin/booking-requests?${query}`)
}
export const getBookingRequestCalendar = (month: string, status?: BookingStatus) => {
  const query = new URLSearchParams({ month })
  if (status) query.set("status", status)
  return request<{ dailyCounts: { preferredDate: string; count: number }[] }>(`/admin/booking-requests/calendar?${query}`)
}
export const updateBookingRequestStatus = (id: string, status: BookingStatus, reason?: string) => request<{ bookingRequest: BookingRequest }>(`/admin/booking-requests/${encodeURIComponent(id)}/status`, { status, ...(reason ? { reason } : {}) }, undefined, "PATCH")

export const cancelMyBookingRequest = (id: string, reason: string) => request<{ bookingRequest: BookingRequest }>(`/booking-requests/${encodeURIComponent(id)}/cancel`, { reason }, undefined, "PATCH")
