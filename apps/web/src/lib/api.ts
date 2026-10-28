export type Profile = {
  id: string;
  firebaseUid: string | null;
  hasPassword: boolean;
  email: string;
  displayName: string | null;
  role: "admin" | "customer";
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
export type PackageContent = {
  name: string; eventTypes: string[]; description: string; guestMin: number; guestMax: number;
  venueDetails: string; inclusions: string[]; exclusions: string[]; terms: string;
  imageUrl: string | null; price: PackagePrice | null
}
export type PackageVersion = PackageContent & {
  id: string; packageId: string; version: number; state: "draft" | "published" | "superseded";
  updatedAt: string; publishedAt: string | null
}
export type PublicPackage = PackageContent & { id: string; versionId: string; version: number; publishedAt: string }
export type AdminPackage = { id: string; archivedAt: string | null; draft: PackageVersion | null; published: PackageVersion | null; versions?: PackageVersion[] }

export const getPackages = () => request<{ packages: PublicPackage[] }>("/packages")
export const getPackage = (id: string) => request<PublicPackage>(`/packages/${encodeURIComponent(id)}`)
export const getAdminPackages = () => request<{ packages: AdminPackage[] }>("/admin/packages")
export const getAdminPackage = (id: string) => request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}`)
export const createPackage = (content: PackageContent) => request<AdminPackage>("/admin/packages", content)
export const updatePackageDraft = (id: string, content: PackageContent, expectedUpdatedAt: string) =>
  request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}/draft`, { ...content, expectedUpdatedAt }, undefined, "PATCH")
export const publishPackage = (id: string, expectedUpdatedAt: string) => request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}/publish`, { expectedUpdatedAt })
export const archivePackage = (id: string) => request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}/archive`, {})
export const deletePackage = (id: string) => request<void>(`/admin/packages/${encodeURIComponent(id)}`, undefined, undefined, "DELETE")

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

// ── Booking types & API ──────────────────────────────────────────────────────

export type BookingStatus =
  | "under_review"
  | "quotation_sent"
  | "awaiting_confirmation"
  | "confirmed"
  | "in_preparation"
  | "completed"
  | "cancelled";

export type Booking = {
  id: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string;
  status: BookingStatus;
  eventName: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventType: string;
  venueName: string;
  guestCount: number;
  specialNotes: string | null;
  coordinator: string;
  packageId: string | null;
  totalPriceMinor: number;
  reservationFeeMinor: number;
  paidAmountMinor: number;
  paymentStatus: string;
  paymentReference: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  services: BookingService[];
};

export const listBookings = (filters?: { status?: string; customerId?: string }) =>
  request<{ bookings: Booking[] }>(
    `/admin/bookings${filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : ""}`,
  );

export const getBooking = (id: string) =>
  request<Booking>(`/admin/bookings/${encodeURIComponent(id)}`);

export const createBooking = (data: {
  customerId: string;
  eventName: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventType: string;
  venueName: string;
  guestCount: number;
  specialNotes?: string;
  coordinator?: string;
  packageId?: string;
  services?: {
    category: string;
    supplierId: string | null;
    assignmentStatus?: "pending" | "confirmed" | "cancelled";
    notes?: string;
  }[];
}) => request<Booking>("/admin/bookings", data);

export const updateBooking = (
  id: string,
  data: {
    eventName?: string;
    eventDate?: string;
    eventStartTime?: string;
    eventEndTime?: string;
    eventType?: string;
    venueName?: string;
    guestCount?: number;
    specialNotes?: string | null;
    coordinator?: string;
    packageId?: string | null;
    totalPriceMinor?: number;
    reservationFeeMinor?: number;
    services?: {
      category: string;
      supplierId: string | null;
      assignmentStatus?: "pending" | "confirmed" | "cancelled";
      notes?: string;
    }[];
  },
) =>
  request<Booking>(
    `/admin/bookings/${encodeURIComponent(id)}`,
    data,
    undefined,
    "PATCH",
  );

export const updateBookingStatus = (id: string, status: BookingStatus) =>
  request<Booking>(`/admin/bookings/${encodeURIComponent(id)}/status`, {
    status,
  });

export const recordBookingPayment = (
  id: string,
  data: { amountMinor: number; paymentReference?: string },
) =>
  request<Booking>(`/admin/bookings/${encodeURIComponent(id)}/payment`, data);

export const deleteBooking = (id: string) =>
  request<void>(
    `/admin/bookings/${encodeURIComponent(id)}`,
    undefined,
    undefined,
    "DELETE",
  );

// ── Supplier types & API ─────────────────────────────────────────────────────

export type Supplier = {
  id: string;
  name: string;
  category: string;
  contactNumber: string | null;
  email: string | null;
  notes: string | null;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierAvailability = {
  available: boolean;
  conflictingBookings: {
    bookingId: string;
    eventName: string;
    eventDate: string;
    eventStartTime: string;
    eventEndTime: string;
  }[];
};

export const listSuppliers = (filters?: { category?: string; search?: string }) =>
  request<{ suppliers: Supplier[] }>(
    `/admin/suppliers${filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : ""}`,
  );

export const getSupplier = (id: string) =>
  request<Supplier>(`/admin/suppliers/${encodeURIComponent(id)}`);

export const getSupplierAvailability = (
  id: string,
  date: string,
  startTime: string,
  endTime: string,
) =>
  request<SupplierAvailability>(
    `/admin/suppliers/${encodeURIComponent(id)}/availability?${new URLSearchParams({ date, startTime, endTime }).toString()}`,
  );

// ── Booking service types ────────────────────────────────────────────────────

export type BookingService = {
  id: string;
  bookingId: string;
  category: string;
  supplierId: string | null;
  supplierName: string | null;
  assignmentStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
