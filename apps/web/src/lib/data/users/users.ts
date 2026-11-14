import { request } from "../../http/request";

export type AdminUser = {
  id: string;
  displayName: string | null;
  email: string;
  role: "admin" | "staff" | "customer";
  staffRole: string | null;
  createdAt: string;
};

export type DirectoryStats = {
  staffTotal: number;
  customerTotal: number;
  staffRoles: number;
  staffJoined: number;
  customerJoined: number;
};
export const getAdminUsers = (
  group: "staff" | "customers",
  search: string,
  cursor?: string,
) => {
  const query = new URLSearchParams({ group, search });
  if (cursor) query.set("cursor", cursor);
  return request<{
    staff: AdminUser[];
    customers: AdminUser[];
    nextCursor: string | null;
    stats: DirectoryStats;
  }>(`/admin/users?${query}`);
};
