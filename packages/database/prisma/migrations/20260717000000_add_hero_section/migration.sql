-- CreateTable
CREATE TABLE "hero_section" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Construindo a maior escola mobile do zero',
    "subtitle" TEXT NOT NULL DEFAULT 'Acompanhe os bastidores técnicos reais através da nossa jornada Build in Public no YouTube. Aprenda engenharia de software de verdade, vendo como as coisas são feitas na prática.',
    "button_text" TEXT NOT NULL DEFAULT 'Acompanhar no YouTube',
    "button_url" TEXT NOT NULL DEFAULT '#',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_section_pkey" PRIMARY KEY ("id")
);
