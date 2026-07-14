-- CreateTable
CREATE TABLE "episodes_button" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT 'Ver todos episódios',
    "url" TEXT NOT NULL DEFAULT '#',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_button_pkey" PRIMARY KEY ("id")
);
