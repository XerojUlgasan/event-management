import { request } from "../http"

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
