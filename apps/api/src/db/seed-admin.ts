import "dotenv/config";
import { db } from "./client.js";
import { getFirebaseAuth } from "../utils/firebase-admin.js";

const email = process.argv[2] ?? process.env.ADMIN_EMAIL;

if (!email) {
  console.error("Usage: pnpm db:seed-admin <email>");
  console.error("Set ADMIN_PASSWORD too when the Firebase user does not exist yet.");
  process.exit(1);
}

const firebaseAuth = getFirebaseAuth();
const fallbackName = email.split("@")[0] ?? "Admin";

let user;
try {
  user = await firebaseAuth.getUserByEmail(email);
} catch (error) {
  if ((error as { code?: string }).code !== "auth/user-not-found") {
    throw error;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error(
      `No Firebase user exists for ${email}. Add ADMIN_PASSWORD to create one, or create it in the Firebase console first.`,
    );
    process.exit(1);
  }

  user = await firebaseAuth.createUser({
    email,
    password,
    displayName: fallbackName,
  });
}

const row = await db
  .insertInto("users")
  .values({
    firebase_uid: user.uid,
    email,
    display_name: user.displayName ?? fallbackName,
    role: "admin",
    staff_role: "System Administrator",
  })
  .onConflict((conflict) =>
    conflict.column("firebase_uid").doUpdateSet({
      email,
      display_name: user.displayName ?? fallbackName,
      role: "admin",
      staff_role: "System Administrator",
      updated_at: new Date(),
    }),
  )
  .returningAll()
  .executeTakeFirstOrThrow();

console.log(`Admin ready: ${row.email} (${row.firebase_uid})`);
await db.destroy();
