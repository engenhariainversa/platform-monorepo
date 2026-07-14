"use client";

import { ArrowRight } from "@repo/ui";
import { getUploadUrl, LANDING_PAGE_CONTENT } from "@repo/graphql";
import type { Episode, LandingPageContent } from "@repo/types";
import { useQuery } from "@repo/graphql/react";

// Bundled artwork, used until an episode has an uploaded image of its own.
const PLACEHOLDER_IMAGES = [
  "/images/ep-01.png",
  "/images/ep-02.png",
  "/images/ep-03.png",
  "/images/ep-04.png",
];

function episodeImageSrc(episode: Episode, index: number) {
  if (episode.imageUrl) {
    return getUploadUrl(episode.imageUrl);
  }
  return PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length]!;
}

export function EpisodesSection() {
  const { data, loading, error } =
    useQuery<LandingPageContent>(LANDING_PAGE_CONTENT);

  if (loading) {
    return <EpisodesSectionSkeleton />;
  }

  const episodes = data?.episodes ?? [];
  const button = data?.episodesButton;

  // No invented content: if the CMS is unreachable or has no episodes, the
  // section is omitted entirely rather than showing placeholder episodes.
  if (error || episodes.length === 0) {
    return null;
  }

  return (
    <section
      id="episodios"
      className="px-margin-mobile md:px-margin-desktop py-xl bg-surface-container-lowest"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-lg gap-md">
          <div className="space-y-xs">
            <h2 className="font-headline text-headline-lg text-on-surface">
              Episódios Recentes
            </h2>
            <div className="h-1 w-32 pipeline-line rounded-full" />
          </div>
          {/* CTA is CMS-managed; omitted entirely until an admin configures it. */}
          {button && (
            <a
              id="btn-all-episodes"
              href={button.url}
              className="text-primary font-bold uppercase font-label text-label-md flex items-center gap-xs hover:gap-sm transition-all"
            >
              {button.text}
              <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Episode Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {episodes.map((ep, index) => (
            <div
              key={ep.id}
              className="group bg-surface-container rounded-lg overflow-hidden border border-outline-variant hover:border-primary transition-colors cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="aspect-video relative">
                {/* Plain <img>, as in LiveCard: uploads are served from the API
                    host, which next/image would route through its optimizer and
                    reject as a non-allowlisted remote host. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={episodeImageSrc(ep, index)}
                  alt={ep.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute bottom-xs right-xs bg-black/80 px-xs text-xs rounded font-code text-code-sm text-white">
                  {ep.duration}
                </span>
              </div>

              {/* Info */}
              <div className="p-md space-y-sm">
                <span className="font-code text-code-sm text-secondary bg-secondary/10 px-xs py-0.5 rounded inline-block">
                  {ep.module}
                </span>
                <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2 text-sm">
                  {ep.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Placeholder shown while the episodes are being fetched. Mirrors the real
// grid so the section doesn't shift once data arrives.
function EpisodesSectionSkeleton() {
  return (
    <section
      id="episodios"
      aria-hidden="true"
      className="px-margin-mobile md:px-margin-desktop py-xl bg-surface-container-lowest"
    >
      <div className="max-w-7xl mx-auto animate-pulse">
        {/* Header placeholder */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-lg gap-md">
          <div className="space-y-xs">
            <div className="h-8 w-72 rounded bg-surface-container-highest" />
            <div className="h-1 w-32 rounded-full bg-surface-container-highest" />
          </div>
          <div className="h-5 w-40 rounded bg-surface-container-highest" />
        </div>

        {/* Grid placeholder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {["a", "b", "c", "d"].map((key) => (
            <div
              key={key}
              className="bg-surface-container rounded-lg overflow-hidden border border-outline-variant"
            >
              <div className="aspect-video bg-surface-container-highest" />
              <div className="p-md space-y-sm">
                <div className="h-5 w-28 rounded bg-surface-container-highest" />
                <div className="h-4 w-full rounded bg-surface-container-highest" />
                <div className="h-4 w-3/4 rounded bg-surface-container-highest" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
