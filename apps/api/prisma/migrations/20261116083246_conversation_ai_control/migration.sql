-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ai_version" INTEGER NOT NULL DEFAULT 0;
