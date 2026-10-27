ALTER TABLE "users" ALTER COLUMN "firebase_uid" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

-- Reject ambiguous existing emails rather than silently merging identities.
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users" (lower(trim("email")));
ALTER TABLE "users" ADD CONSTRAINT "users_identity_check"
  CHECK ("firebase_uid" IS NOT NULL OR "password_hash" IS NOT NULL);
