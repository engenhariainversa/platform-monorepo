"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@repo/graphql/react";
import { GET_HERO_SECTION, UPSERT_HERO_SECTION } from "@repo/graphql";
import type { HeroSection } from "@repo/types";

type HeroInput = Omit<HeroSection, "id">;

const emptyHero: HeroInput = {
  title: "Construindo a maior escola mobile do zero",
  subtitle:
    "Acompanhe os bastidores técnicos reais através da nossa jornada Build in Public no YouTube. Aprenda engenharia de software de verdade, vendo como as coisas são feitas na prática.",
  buttonText: "Acompanhar no YouTube",
  buttonUrl: "#",
};

export default function HeroContentPage() {
  const [hero, setHero] = useState<HeroInput>(emptyHero);
  const [saved, setSaved] = useState(false);

  const { data, loading } = useQuery<{ heroSection: HeroSection | null }>(
    GET_HERO_SECTION,
  );

  useEffect(() => {
    if (data?.heroSection) {
      const { id, ...rest } = data.heroSection;
      setHero(rest);
    }
  }, [data]);

  const [upsertHero, { loading: saving }] = useMutation<{
    upsertHeroSection: HeroSection;
  }>(UPSERT_HERO_SECTION);

  const handleSave = async () => {
    try {
      const { data: result } = await upsertHero({ variables: { input: hero } });
      if (result?.upsertHeroSection) {
        const { id, ...rest } = result.upsertHeroSection;
        setHero(rest);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/content"
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            ← Conteúdo
          </Link>
          <span className="text-outline-variant">/</span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Hero Section
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-on-primary font-bold px-6 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saved ? "✓ Salvo!" : saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Conteúdo
          </h2>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1 font-label">
              Título
            </label>
            <input
              type="text"
              value={hero.title}
              onChange={(e) => setHero({ ...hero, title: e.target.value })}
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1 font-label">
              Subtítulo
            </label>
            <textarea
              value={hero.subtitle}
              onChange={(e) => setHero({ ...hero, subtitle: e.target.value })}
              rows={4}
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm resize-none"
            />
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Botão
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Texto do Botão
              </label>
              <input
                type="text"
                value={hero.buttonText}
                onChange={(e) =>
                  setHero({ ...hero, buttonText: e.target.value })
                }
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Link do Botão
              </label>
              <input
                type="url"
                value={hero.buttonUrl}
                onChange={(e) => setHero({ ...hero, buttonUrl: e.target.value })}
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm font-code"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
