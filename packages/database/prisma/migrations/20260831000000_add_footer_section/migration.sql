-- CreateTable
CREATE TABLE "footer_section" (
    "id" TEXT NOT NULL,
    "newsletter_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "footer_section_pkey" PRIMARY KEY ("id")
);
