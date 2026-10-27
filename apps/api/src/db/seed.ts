import "dotenv/config";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { db } from "./client.js";
import { hashPassword } from "../lib/password.js";

const accounts = [
  { email: "admin1@gmail.com", display_name: "Admin 1", role: "admin" },
  ...Array.from({ length: 5 }, (_, index) => ({
    email: `user${index + 1}@gmail.com`,
    display_name: `User ${index + 1}`,
    role: "customer",
  })),
];

try {
  const seeded = await db.transaction().execute(async (db) => {
    const rows = [];
    for (const account of accounts) {
      const values = {
        id: randomUUID(),
        ...account,
        password_hash: await hashPassword("p@ssword01"),
      };
      const row = await db
        .insertInto("users")
        .values(values)
        .onConflict((conflict) =>
          conflict
            .expression(sql`lower(trim(email))`)
            .doUpdateSet({
              display_name: account.display_name,
              role: account.role,
              password_hash: values.password_hash,
              updated_at: new Date(),
            }),
        )
        .returning(["id", "email", "role"])
        .executeTakeFirstOrThrow();
      rows.push(row);
    }
    // Password resets invalidate previous sessions for these demo accounts only.
    await db
      .deleteFrom("sessions")
      .where(
        "user_id",
        "in",
        rows.map((row) => row.id),
      )
      .execute();
    return rows;
  });
  console.table(seeded.map(({ email, role }) => ({ email, role })));
  console.log(`Seeded ${seeded.length} local accounts.`);
} finally {
  await db.destroy();
}
