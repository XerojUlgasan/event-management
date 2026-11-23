import { request } from "../../http/request";

export type AdminUser = {
  id: string;
  displayName: string | null;
  email: string;
  role: "customer";
  createdAt: string;
};

export type DirectoryStats = {
  customerTotal: number;
  customerJoined: number;
};

export const getAdminUsers = (search: string, cursor?: string) => {
  const query = new URLSearchParams({ search });

  if (cursor) query.set("cursor", cursor);

  return request<{
    customers: AdminUser[];
    nextCursor: string | null;
    stats: DirectoryStats;
  }>(`/admin/users?${query}`);
};
