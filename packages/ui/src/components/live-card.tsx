"use client";

import { Play, Eye, Calendar } from "../icons";
import { cn } from "../utils";

export type LiveCardDevice = "responsive" | "desktop" | "mobile";

export type LiveCardProps = {
  label: string;
  title: string;
  description: string;
  ctaLabel: string;
  buttonUrl?: string;
  /** Fully-resolved image URL; a placeholder is shown when omitted. */
  thumbnailSrc?: string;
  isLiveNow: boolean;
  /** Formatted event start; shown in the badge slot before the event begins. */
  occursLabel?: string | null;
  viewersCount?: string;
  /**
   * Layout mode. "responsive" (default) follows the viewport with `md:`
   * breakpoints — used on the landing. "desktop"/"mobile" force a fixed layout
   * regardless of viewport, so the CMS can render device previews side by side.
   */
  device?: LiveCardDevice;
  /**
   * Static preview: the CTA renders as a non-navigating element and the play
   * overlay is always visible (no hover affordance in a preview panel).
   */
  preview?: boolean;
};

// Literal class strings per device mode. They must stay literal (not built by
// concatenating `md:` prefixes) so Tailwind's JIT scanner picks them up in both
// apps, whose content globs include this package's source.
const cls = {
  root: {
    responsive: "flex-col md:flex-row",
    desktop: "flex-row",
    mobile: "flex-col",
  },
  media: {
    responsive: "md:w-1/2",
    desktop: "w-1/2",
    mobile: "w-full",
  },
  overlay: {
    responsive:
      "bg-black/30 md:bg-black/40 opacity-100 md:opacity-0 md:group-hover:opacity-100",
    desktop: "bg-black/40 opacity-0 group-hover:opacity-100",
    mobile: "bg-black/30 opacity-100",
  },
  overlayPreview: {
    responsive: "bg-black/30 md:bg-black/40 opacity-100",
    desktop: "bg-black/40 opacity-100",
    mobile: "bg-black/30 opacity-100",
  },
  playIcon: {
    responsive: "w-12 h-12 md:w-16 md:h-16",
    desktop: "w-16 h-16",
    mobile: "w-12 h-12",
  },
  badgeInset: {
    responsive: "top-sm left-sm md:top-md md:left-md",
    desktop: "top-md left-md",
    mobile: "top-sm left-sm",
  },
  viewersInset: {
    responsive: "bottom-sm left-sm md:bottom-md md:left-md",
    desktop: "bottom-md left-md",
    mobile: "bottom-sm left-sm",
  },
  info: {
    responsive: "md:w-1/2 p-md md:p-lg gap-sm md:gap-md",
    desktop: "w-1/2 p-lg gap-md",
    mobile: "w-full p-md gap-sm",
  },
  title: {
    responsive: "text-headline-lg-mobile md:text-headline-lg",
    desktop: "text-headline-lg",
    mobile: "text-headline-lg-mobile",
  },
  cta: {
    responsive: "w-full md:w-fit py-sm md:py-md px-lg md:px-xl mt-xs md:mt-0",
    desktop: "w-fit py-md px-xl mt-0",
    mobile: "w-full py-sm px-lg mt-xs",
  },
} as const;

/**
 * Formats a live event's start instant the way the badge shows it (pt-BR, e.g.
 * "12 de julho, 20:00"). Shared so the landing and the CMS preview render an
 * identical label. Returns null for missing/invalid input.
 */
export function formatLiveDate(
  iso: string | null | undefined,
  timeZone?: string | null,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timeZone || undefined,
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LiveCard({
  label,
  title,
  description,
  ctaLabel,
  buttonUrl = "#",
  thumbnailSrc,
  isLiveNow,
  occursLabel,
  viewersCount,
  device = "responsive",
  preview = false,
}: LiveCardProps) {
  const ctaClass = cn(
    "justify-center bg-primary-container text-on-primary font-bold uppercase rounded-lg glow-primary flex items-center gap-sm",
    cls.cta[device],
  );

  return (
    <div
      className={cn(
        "bg-surface-container-high rounded-xl overflow-hidden border border-outline-variant flex items-stretch shadow-2xl relative",
        cls.root[device],
      )}
    >
      {/* Video Thumbnail */}
      <div
        className={cn(
          "aspect-video bg-surface-container relative overflow-hidden group",
          cls.media[device],
        )}
      >
        {thumbnailSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailSrc}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-code-sm">
            Sem thumbnail
          </div>
        )}

        {/* Play Overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity cursor-pointer",
            preview ? cls.overlayPreview[device] : cls.overlay[device],
          )}
        >
          <Play
            className={cn(
              "text-white fill-white drop-shadow-lg",
              cls.playIcon[device],
            )}
          />
        </div>

        {/* Live Badge */}
        {isLiveNow && (
          <div
            className={cn(
              "absolute bg-error text-on-error-container font-bold text-code-sm px-base py-1 rounded-sm flex items-center gap-xs",
              cls.badgeInset[device],
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            AO VIVO AGORA
          </div>
        )}

        {/* Scheduled Date */}
        {!isLiveNow && occursLabel && (
          <div
            className={cn(
              "absolute bg-black/60 backdrop-blur-md text-white font-bold text-code-sm px-base py-1 rounded-sm flex items-center gap-xs uppercase",
              cls.badgeInset[device],
            )}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            {occursLabel}
          </div>
        )}

        {/* Viewers Count */}
        {isLiveNow && viewersCount && (
          <div
            className={cn(
              "absolute bg-black/60 backdrop-blur-md px-base py-xs rounded text-code-sm text-white flex items-center gap-xs",
              cls.viewersInset[device],
            )}
          >
            <Eye className="w-4 h-4 shrink-0" />
            {viewersCount} assistindo
          </div>
        )}
      </div>

      {/* Live Info */}
      <div className={cn("flex flex-col justify-center", cls.info[device])}>
        <div className="space-y-xs">
          <p className="font-code text-code-sm text-primary">{label}</p>
          <h2 className={cn("font-headline text-on-surface", cls.title[device])}>
            {title}
          </h2>
        </div>
        <p className="font-body text-body-md text-on-surface-variant">
          {description}
        </p>
        {preview ? (
          <span className={cn(ctaClass, "cursor-default select-none")}>
            {ctaLabel}
          </span>
        ) : (
          <a
            id="cta-live"
            href={buttonUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(ctaClass, "transition-all")}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
