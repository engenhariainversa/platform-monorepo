-- CreateTable
CREATE TABLE "about_section" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'A Escola do Futuro',
    "body" TEXT NOT NULL,
    "stat1_value" TEXT NOT NULL DEFAULT '100+',
    "stat1_label" TEXT NOT NULL DEFAULT 'Horas de Live',
    "stat2_value" TEXT NOT NULL DEFAULT '15k',
    "stat2_label" TEXT NOT NULL DEFAULT 'Devs Ativos',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "about_section_pkey" PRIMARY KEY ("id")
);
