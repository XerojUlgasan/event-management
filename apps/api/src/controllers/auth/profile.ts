import { z } from "@hono/zod-openapi";
import type { Selectable } from "kysely";
import type { Users } from "../../db/types.js";

export const errorSchema = z.object({ error: z.string() });

export const profileSchema = z.object({
  id: z.string().uuid(),
  firebaseUid: z.string().nullable(),
  hasPassword: z.boolean(),
  email: z.string(),
  displayName: z.string().nullable(),
  role: z.enum(["admin", "staff", "customer"]),
  staffRole: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;

export function toProfile(row: Selectable<Users>): Profile {
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    hasPassword: row.password_hash !== null,
    email: row.email,
    displayName: row.display_name,
    role:
      row.role === "admin"
        ? "admin"
        : row.role === "staff"
          ? "staff"
          : "customer",
    staffRole: row.staff_role ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
