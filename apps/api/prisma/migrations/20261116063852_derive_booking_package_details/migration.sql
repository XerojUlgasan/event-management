/*
  Warnings:

  - You are about to drop the column `package_max_guests` on the `booking_requests` table. All the data in the column will be lost.
  - You are about to drop the column `package_name` on the `booking_requests` table. All the data in the column will be lost.
  - You are about to drop the column `package_price` on the `booking_requests` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "booking_requests" DROP COLUMN "package_max_guests",
DROP COLUMN "package_name",
DROP COLUMN "package_price";
