"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@repo/graphql/react";
import { GET_ABOUT_SECTION, UPSERT_ABOUT_SECTION } from "@repo/graphql";
import type { AboutSection } from "@repo/types";

type AboutInput = Omit<AboutSection, "id">;

const emptyAbout: AboutInput = {
  title: "A Escola do Futuro",
  body: [
    "A Engenharia Inversa não é apenas uma escola de cursos. É uma fábrica de software que opera de portas abertas. Nosso diferencial é a transparência absoluta.",
    "Enquanto outros ensinam apenas a sintaxe, nós ensinamos o \"porquê\". Mostramos os erros de arquitetura, as refatorações difíceis e as decisões técnicas que ninguém te conta nos cursos tradicionais.",
    "Nosso modelo Build in Public garante que você veja o projeto crescendo, evoluindo e sendo testado em produção real.",
  ].join("\n\n"),
  stat1Value: "100+",
  stat1Label: "Horas de Live",
  stat2Value: "15k",
  stat2Label: "Devs Ativos",
};

export default function AboutContentPage() {
  const [about, setAbout] = useState<AboutInput>(emptyAbout);
  const [saved, setSaved] = useState(false);

  const { data, loading } = useQuery<{ aboutSection: AboutSection | null }>(
    GET_ABOUT_SECTION,
  );

  useEffect(() => {
    if (data?.aboutSection) {
      const { id, ...rest } = data.aboutSection;
      setAbout(rest);
    }
  }, [data]);

  const [upsertAbout, { loading: saving }] = useMutation<{
    upsertAboutSection: AboutSection;
  }>(UPSERT_ABOUT_SECTION);

  const handleSave = async () => {
    try {
      const { data: result } = await upsertAbout({
        variables: { input: about },
      });
      if (result?.upsertAboutSection) {
        const { id, ...rest } = result.upsertAboutSection;
        setAbout(rest);
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
            Sobre
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
            Texto
          </h2>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1 font-label">
              Título
            </label>
            <input
              type="text"
              value={about.title}
              onChange={(e) => setAbout({ ...about, title: e.target.value })}
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1 font-label">
              Parágrafos
            </label>
            <textarea
              value={about.body}
              onChange={(e) => setAbout({ ...about, body: e.target.value })}
              rows={10}
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm resize-y leading-relaxed"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Separe os parágrafos com uma linha em branco.
            </p>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Indicadores
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Stat 1 */}
            <div className="space-y-4 border-l-4 border-primary pl-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Indicador 1 — Valor
                </label>
                <input
                  type="text"
                  value={about.stat1Value}
                  onChange={(e) =>
                    setAbout({ ...about, stat1Value: e.target.value })
                  }
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Indicador 1 — Legenda
                </label>
                <input
                  type="text"
                  value={about.stat1Label}
                  onChange={(e) =>
                    setAbout({ ...about, stat1Label: e.target.value })
                  }
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Stat 2 */}
            <div className="space-y-4 border-l-4 border-secondary pl-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Indicador 2 — Valor
                </label>
                <input
                  type="text"
                  value={about.stat2Value}
                  onChange={(e) =>
                    setAbout({ ...about, stat2Value: e.target.value })
                  }
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Indicador 2 — Legenda
                </label>
                <input
                  type="text"
                  value={about.stat2Label}
                  onChange={(e) =>
                    setAbout({ ...about, stat2Label: e.target.value })
                  }
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
