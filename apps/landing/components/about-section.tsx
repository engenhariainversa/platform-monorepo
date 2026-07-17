"use client";

import Image from "next/image";
import { LANDING_PAGE_CONTENT } from "@repo/graphql";
import type { LandingPageContent } from "@repo/types";
import { useQuery } from "@repo/graphql/react";

// The about section always renders, so — like the hero — it falls back to this
// baked-in copy while the CMS content loads or if the API is unreachable. The
// body is plain text with blank lines between paragraphs.
const FALLBACK = {
  title: "A Escola do Futuro",
  body: [
    "A Engenharia Inversa não é apenas uma escola de cursos. É uma fábrica de software que opera de portas abertas. Nosso diferencial é a transparência absoluta.",
    'Enquanto outros ensinam apenas a sintaxe, nós ensinamos o "porquê". Mostramos os erros de arquitetura, as refatorações difíceis e as decisões técnicas que ninguém te conta nos cursos tradicionais.',
    "Nosso modelo Build in Public garante que você veja o projeto crescendo, evoluindo e sendo testado em produção real.",
  ].join("\n\n"),
  stat1Value: "100+",
  stat1Label: "Horas de Live",
  stat2Value: "15k",
  stat2Label: "Devs Ativos",
};

// Split the plain-text body into paragraphs on blank lines, dropping empties.
function toParagraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const pipelineSteps = [
  {
    level: 0,
    title: "Nível Zero: Fundamentos",
    subtitle: "Lógica, Git e Setup Profissional",
    status: "active" as const,
  },
  {
    level: 1,
    title: "Core: Arquitetura",
    subtitle: "Clean Architecture & Design Patterns",
    status: "next" as const,
  },
  {
    level: 2,
    title: "Avançado: Scalability",
    subtitle: "CI/CD, Performance & Security",
    status: "locked" as const,
  },
];

export function AboutSection() {
  const { data, loading } = useQuery<LandingPageContent>(LANDING_PAGE_CONTENT);

  const about = data?.aboutSection ?? FALLBACK;
  const paragraphs = toParagraphs(about.body);

  return (
    <section
      id="sobre"
      className="px-margin-mobile md:px-margin-desktop py-xl"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-xl items-center">
        {/* Text Content */}
        {loading ? (
          <AboutTextSkeleton />
        ) : (
          <div className="space-y-md">
            <h2 className="font-headline text-headline-lg text-on-surface">
              {about.title}
            </h2>

            <div className="space-y-base font-body text-body-md text-on-surface-variant leading-relaxed">
              {paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-md pt-md">
              <div className="p-md bg-surface-container rounded-lg border-l-4 border-primary">
                <span className="font-headline text-headline-lg text-primary block">
                  {about.stat1Value}
                </span>
                <span className="font-code text-code-sm uppercase tracking-wider text-on-surface-variant">
                  {about.stat1Label}
                </span>
              </div>
              <div className="p-md bg-surface-container rounded-lg border-l-4 border-secondary">
                <span className="font-headline text-headline-lg text-secondary block">
                  {about.stat2Value}
                </span>
                <span className="font-code text-code-sm uppercase tracking-wider text-on-surface-variant">
                  {about.stat2Label}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline de Aprendizado */}
        <div className="relative bg-surface-container-high p-lg rounded-xl border border-outline-variant overflow-hidden">
          <div className="space-y-lg relative z-10">
            <h3 className="font-code text-code-sm text-primary uppercase tracking-widest mb-md">
              Pipeline de Aprendizado
            </h3>

            {pipelineSteps.map((step, i) => (
              <div key={step.level}>
                <div
                  className={`flex items-center gap-md ${step.status === "locked" ? "opacity-50" : ""}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      step.status === "active"
                        ? "bg-primary text-on-primary"
                        : step.status === "next"
                          ? "border-2 border-primary-fixed-dim text-primary-fixed-dim"
                          : "border-2 border-outline-variant text-on-surface-variant"
                    }`}
                  >
                    {step.level}
                  </div>
                  <div>
                    <p className="font-bold text-on-surface">{step.title}</p>
                    <p className="text-code-sm font-code text-on-surface-variant">
                      {step.subtitle}
                    </p>
                  </div>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <div className="w-px h-8 bg-outline-variant ml-6" />
                )}
              </div>
            ))}
          </div>

          {/* Ghost Logo */}
          <div className="absolute bottom-0 right-0 p-lg opacity-10">
            <Image
              src="/images/logo-mascot.png"
              alt=""
              width={256}
              height={256}
              className="w-64 grayscale"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Placeholder for the CMS-managed text column (heading, paragraphs, stats)
// shown while the content loads. Mirrors the real layout so it doesn't shift.
// The pipeline column beside it isn't CMS-managed and renders for real.
function AboutTextSkeleton() {
  return (
    <div className="space-y-md w-full animate-pulse" aria-hidden="true">
      {/* Heading */}
      <div className="h-9 w-2/3 rounded-lg bg-surface-container-high" />

      {/* Paragraphs */}
      <div className="space-y-base">
        {["a", "b", "c"].map((block) => (
          <div key={block} className="space-y-2">
            <div className="h-4 w-full rounded bg-surface-container-high" />
            <div className="h-4 w-full rounded bg-surface-container-high" />
            <div className="h-4 w-4/5 rounded bg-surface-container-high" />
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-md pt-md">
        <div className="p-md bg-surface-container rounded-lg border-l-4 border-primary space-y-2">
          <div className="h-8 w-20 rounded bg-surface-container-high" />
          <div className="h-3 w-28 rounded bg-surface-container-high" />
        </div>
        <div className="p-md bg-surface-container rounded-lg border-l-4 border-secondary space-y-2">
          <div className="h-8 w-20 rounded bg-surface-container-high" />
          <div className="h-3 w-28 rounded bg-surface-container-high" />
        </div>
      </div>
    </div>
  );
}
