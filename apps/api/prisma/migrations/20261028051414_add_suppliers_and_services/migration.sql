-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contact_number" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_services" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "supplier_id" UUID,
    "assignment_status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_category_idx" ON "suppliers"("category");

-- CreateIndex
CREATE INDEX "booking_services_booking_id_idx" ON "booking_services"("booking_id");

-- CreateIndex
CREATE INDEX "booking_services_supplier_id_idx" ON "booking_services"("supplier_id");

-- CreateIndex
CREATE INDEX "booking_services_supplier_id_assignment_status_idx" ON "booking_services"("supplier_id", "assignment_status");

-- AddForeignKey
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
