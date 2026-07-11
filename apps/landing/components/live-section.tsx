"use client";

import { Play, Eye } from "@repo/ui";
import { getUploadUrl, GET_LIVE } from "@repo/graphql";
import type { LiveData } from "@repo/types";
import { useQuery } from "@repo/graphql/react";

// Fallback content shown while loading or if the CMS is unreachable.
const FALLBACK: LiveData = {
  id: "",
  label: "PRÓXIMA ETAPA DO PIPELINE",
  title: "Live #24: Implementando CI/CD com Fastlane e GitHub Actions",
  description:
    "Hoje vamos configurar toda a automação de deploy para App Store e Play Store. Do zero absoluto ao deploy automatizado.",
  buttonText: "Entrar na Live",
  buttonUrl: "#",
  thumbnailUrl: "",
  isLive: true,
  viewersCount: "1.2k",
};

export function LiveSection() {
  const { data: queryData, loading } = useQuery<{ live: LiveData | null }>(
    GET_LIVE,
  );

  if (loading) {
    return <LiveSectionSkeleton />;
  }

  const data = queryData?.live ?? FALLBACK;
  const thumbnailSrc = data.thumbnailUrl
    ? getUploadUrl(data.thumbnailUrl)
    : "/images/live-studio.png";

  return (
    <section id="live" className="px-margin-mobile md:px-margin-desktop pb-xl">
      <div className="max-w-7xl mx-auto">
        <div className="bg-surface-container-high rounded-xl overflow-hidden border border-outline-variant flex flex-col md:flex-row items-stretch shadow-2xl relative">
          {/* Video Thumbnail */}
          <div className="md:w-1/2 aspect-video bg-surface-container relative overflow-hidden group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailSrc}
              alt="Estúdio de streaming para desenvolvimento mobile"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Play Overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Play className="w-16 h-16 text-white fill-white" />
            </div>
            {/* Live Badge */}
            {data.isLive && (
              <div className="absolute top-md left-md bg-error text-on-error-container font-bold text-code-sm px-base py-1 rounded-sm flex items-center gap-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                AO VIVO AGORA
              </div>
            )}
            {/* Viewers Count */}
            {data.isLive && (
              <div className="absolute bottom-md left-md bg-black/60 backdrop-blur-md px-base py-xs rounded text-code-sm text-white flex items-center gap-xs">
                <Eye className="w-4 h-4" />
                {data.viewersCount} assistindo
              </div>
            )}
          </div>

          {/* Live Info */}
          <div className="md:w-1/2 p-lg flex flex-col justify-center space-y-md">
            <div className="space-y-xs">
              <p className="font-code text-code-sm text-primary">{data.label}</p>
              <h2 className="font-headline text-headline-lg-mobile md:text-headline-lg text-on-surface">
                {data.title}
              </h2>
            </div>
            <p className="font-body text-body-md text-on-surface-variant">
              {data.description}
            </p>
            <a
              id="cta-live"
              href={data.buttonUrl || "#"}
              className="w-fit bg-primary-container text-on-primary font-bold uppercase py-md px-xl rounded-lg glow-primary transition-all flex items-center gap-sm"
            >
              {data.buttonText}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// Placeholder shown while the live content is being fetched. Mirrors the real
// layout so the section doesn't shift once data arrives.
function LiveSectionSkeleton() {
  return (
    <section
      id="live"
      aria-hidden="true"
      className="px-margin-mobile md:px-margin-desktop pb-xl"
    >
      <div className="max-w-7xl mx-auto">
        <div className="bg-surface-container-high rounded-xl overflow-hidden border border-outline-variant flex flex-col md:flex-row items-stretch shadow-2xl animate-pulse">
          {/* Thumbnail placeholder */}
          <div className="md:w-1/2 aspect-video bg-surface-container-highest" />

          {/* Info placeholder */}
          <div className="md:w-1/2 p-lg flex flex-col justify-center space-y-md">
            <div className="space-y-xs">
              <div className="h-3 w-2/5 rounded bg-surface-container-highest" />
              <div className="h-7 w-11/12 rounded bg-surface-container-highest" />
              <div className="h-7 w-3/4 rounded bg-surface-container-highest" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-surface-container-highest" />
              <div className="h-4 w-5/6 rounded bg-surface-container-highest" />
            </div>
            <div className="h-12 w-48 rounded-lg bg-surface-container-highest" />
          </div>
        </div>
      </div>
    </section>
  );
}
