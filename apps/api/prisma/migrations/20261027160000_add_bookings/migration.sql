-- DropForeignKey
ALTER TABLE "package_versions" DROP CONSTRAINT "package_versions_package_id_fkey";

-- AlterTable
ALTER TABLE "package_images" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "package_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "packages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'under_review',
    "event_name" TEXT NOT NULL,
    "event_date" TIMESTAMPTZ(6) NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "special_notes" TEXT,
    "coordinator" TEXT NOT NULL DEFAULT 'Unassigned',
    "package_id" UUID,
    "total_price_minor" INTEGER NOT NULL DEFAULT 0,
    "reservation_fee_minor" INTEGER NOT NULL DEFAULT 0,
    "paid_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "payment_reference" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_event_date_idx" ON "bookings"("event_date");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- AddForeignKey
ALTER TABLE "package_versions" ADD CONSTRAINT "package_versions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
