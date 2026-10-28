-- DropForeignKey
ALTER TABLE "package_versions" DROP CONSTRAINT "package_versions_package_id_fkey";

-- AlterTable
ALTER TABLE "conversations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT;

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

-- AddForeignKey
ALTER TABLE "package_versions" ADD CONSTRAINT "package_versions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
