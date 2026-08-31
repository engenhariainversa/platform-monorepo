-- AlterTable
ALTER TABLE "footer_section" ADD COLUMN     "social_links_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "social_links" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- Backfill the four links the footer had hardcoded, so the block renders exactly
-- as it did before this migration. Their URLs were already placeholders ("#") in
-- the code; an admin now replaces them from the CMS, or deletes the rows.
INSERT INTO "social_links" ("id", "label", "url", "order", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'YouTube', '#', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'GitHub', '#', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Discord', '#', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Newsletter', '#', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
