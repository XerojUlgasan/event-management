import type {
  CatalogPackage,
  PackageContent,
  PackageAddonService,
} from "@event-management/contracts/catalog";
import type { BookingRequest } from "./requests";
import { request } from "../../http/request";

export type BookingPackageResult = {
  package: CatalogPackage | null;
  bookingUpdatedAt: string;
};

export const getBookingPackage = (id: string, admin: boolean) =>
  request<BookingPackageResult>(
    `${admin ? "/admin" : ""}/booking-requests/${encodeURIComponent(id)}/package`,
  );

export const saveBookingPackage = (
  id: string,
  content: PackageContent,
  revisions: {
    expectedBookingUpdatedAt: string;
    expectedUpdatedAt?: string;
    sourcePackageId?: string;
  },
  exists: boolean,
  thumbnailMediaId?: string | null,
) =>
  request<{ package: CatalogPackage; bookingRequest: BookingRequest }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/custom-package`,
    {
      ...content,
      ...revisions,
      ...(thumbnailMediaId !== undefined ? { thumbnailMediaId } : {}),
    },
    undefined,
    exists ? "PATCH" : "POST",
  );

export type PackageHistoryEntry = {
  id: string;
  actorId: string | null;
  actorName?: string | null;
  action: string;
  before: (CatalogPackage & { addonServices?: PackageAddonService[] }) | null;
  after: CatalogPackage & { addonServices?: PackageAddonService[] };
  createdAt: string;
};

export const getBookingPackageHistory = (id: string, cursor?: string) =>
  request<{ history: PackageHistoryEntry[]; nextCursor: string | null }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/package-history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );

export const assignBookingPackage = (
  id: string,
  body: {
    packageId: string;
    expectedBookingUpdatedAt: string;
    packageUpdatedAt?: string;
  },
) =>
  request<{ bookingRequest: BookingRequest }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/package`,
    body,
  );
