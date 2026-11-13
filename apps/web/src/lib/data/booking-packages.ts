import type {
  CatalogPackage,
  PackageContent,
} from "@event-management/contracts/catalog";
import type { BookingRequest } from "./booking-requests";
import { request } from "../http";

export type BookingPackageResult = {
  package: CatalogPackage;
  bookingUpdatedAt: string;
};
export const getBookingPackage = (id: string, admin: boolean) =>
  request<BookingPackageResult>(
    `${admin ? "/admin" : ""}/booking-requests/${encodeURIComponent(id)}/package`,
  );
export const saveBookingPackage = (
  id: string,
  content: PackageContent & {
    services: { serviceId: string; role: "included" | "optional" }[];
  },
  revisions: {
    expectedBookingUpdatedAt: string;
    expectedUpdatedAt: string;
    sourcePackageId?: string;
  },
  exists: boolean,
) =>
  request<{ package: CatalogPackage; bookingRequest: BookingRequest }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/custom-package`,
    { ...content, ...revisions },
    undefined,
    exists ? "PATCH" : "POST",
  );

export type PackageHistoryEntry = {
  id: string;
  actorId: string | null;
  action: string;
  before: CatalogPackage;
  after: CatalogPackage;
  createdAt: string;
};
export const getBookingPackageHistory = (id: string, cursor?: string) =>
  request<{ history: PackageHistoryEntry[]; nextCursor: string | null }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/package-history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
