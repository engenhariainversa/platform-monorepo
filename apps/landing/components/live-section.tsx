"use client";

import { LiveCard, formatLiveDate } from "@repo/ui";
import { getUploadUrl, LANDING_PAGE_CONTENT } from "@repo/graphql";
import type { LandingPageContent } from "@repo/types";
import { useQuery } from "@repo/graphql/react";

export function LiveSection() {
  const {
    data: queryData,
    loading,
    error,
  } = useQuery<LandingPageContent>(LANDING_PAGE_CONTENT);

  if (loading) {
    return <LiveSectionSkeleton />;
  }

  const data = queryData?.live;

  // No invented content: if the CMS is unreachable or has no live configured,
  // the section is omitted entirely rather than showing placeholder copy.
  // The admin can also hide the section explicitly via `isVisible`.
  if (error || !data || !data.isVisible) {
    return null;
  }

  const thumbnailSrc = data.thumbnailUrl
    ? getUploadUrl(data.thumbnailUrl)
    : "/images/live-studio.png";

  // Once a start date is scheduled, it drives the "live" state: the badge shows
  // only after the event's instant has passed. Without a date we fall back to
  // the manual toggle set in the CMS.
  const isLiveNow = data.occursAt
    ? new Date(data.occursAt).getTime() <= Date.now()
    : data.isLive;
  const ctaLabel = isLiveNow ? data.buttonText : data.buttonTextBefore;

  // Human-readable event start, rendered in the timezone the admin scheduled it
  // in. Shown before the event begins, in place of the "AO VIVO" badge.
  const occursLabel = isLiveNow
    ? null
    : formatLiveDate(data.occursAt, data.occursAtTimezone);

  return (
    <section id="live" className="px-margin-mobile md:px-margin-desktop pb-xl">
      <div className="max-w-7xl mx-auto">
        <LiveCard
          label={data.label}
          title={data.title}
          description={data.description}
          ctaLabel={ctaLabel}
          buttonUrl={data.buttonUrl}
          thumbnailSrc={thumbnailSrc}
          isLiveNow={isLiveNow}
          occursLabel={occursLabel}
          viewersCount={data.viewersCount}
        />
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
          <div className="md:w-1/2 p-md md:p-lg flex flex-col justify-center gap-sm md:gap-md">
            <div className="space-y-xs">
              <div className="h-3 w-2/5 rounded bg-surface-container-highest" />
              <div className="h-7 w-11/12 rounded bg-surface-container-highest" />
              <div className="h-7 w-3/4 rounded bg-surface-container-highest" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-surface-container-highest" />
              <div className="h-4 w-5/6 rounded bg-surface-container-highest" />
            </div>
            <div className="h-12 w-full md:w-48 rounded-lg bg-surface-container-highest" />
          </div>
        </div>
      </div>
    </section>
  );
}
