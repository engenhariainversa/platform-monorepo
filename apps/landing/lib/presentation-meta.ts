import type { Metadata } from "next";
import type { Presentation } from "@repo/types";

export const SITE_NAME = "Engenharia Inversa";
export const AUTHOR_NAME = "Pedro Goiano";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

const DESCRIPTION_MAX = 200;

/** Public origin of the landing, without a trailing slash. */
export function siteUrl(): string {
  return (process.env.LANDING_URL ?? "https://engenhariainversa.com.br").replace(/\/+$/, "");
}

export type CoverInfo = {
  label: string | null;
  title: string;
  subtitle: string | null;
  date: string | null;
};

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:–-]+$/, "")}…`;
}

/**
 * What the share card shows: the first visible cover slide, falling back to
 * the deck's own title when it has no cover (or the cover has no title).
 */
export function coverInfo(presentation: Presentation): CoverInfo {
  const cover = [...presentation.slides]
    .sort((a, b) => a.order - b.order)
    .find((slide) => slide.template === "cover" && !slide.hidden);
  const content = cover?.content ?? {};
  return {
    label: text(content.label),
    title: text(content.title) ?? presentation.title,
    subtitle: text(content.subtitle),
    date: text(content.date),
  };
}

/** Cover subtitle, else the deck description, else a generic one-liner. */
export function presentationDescription(presentation: Presentation): string {
  const description =
    coverInfo(presentation).subtitle ??
    text(presentation.description) ??
    `Apresentação de ${AUTHOR_NAME} no ${SITE_NAME}.`;
  return truncate(description, DESCRIPTION_MAX);
}

export function presentationUrl(slug: string, base: string = siteUrl()): string {
  return `${base}/apresentacoes/${encodeURIComponent(slug)}`;
}

/**
 * The image URL carries the deck's last update so scrapers that cache by URL
 * (WhatsApp, X) pick up a new card after the cover is edited.
 */
export function presentationImageUrl(presentation: Presentation, base: string = siteUrl()): string {
  const version = Date.parse(presentation.updatedAt);
  const suffix = Number.isNaN(version) ? "" : `?v=${version}`;
  return `${presentationUrl(presentation.slug, base)}/og.png${suffix}`;
}

/**
 * Metadata for /apresentacoes/<slug>. A deck that is missing or not public is
 * `null` here and gets the same bare "not found" metadata either way, so the
 * response says nothing about a private deck — not even that it exists.
 */
export function presentationMetadata(presentation: Presentation | null, base: string = siteUrl()): Metadata {
  if (!presentation) {
    return {
      title: `Apresentação não encontrada | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }
  const description = presentationDescription(presentation);
  const url = presentationUrl(presentation.slug, base);
  const image = {
    url: presentationImageUrl(presentation, base),
    ...OG_IMAGE_SIZE,
    type: "image/png",
    alt: `${presentation.title} — ${AUTHOR_NAME}, ${SITE_NAME}`,
  };
  return {
    title: `${presentation.title} | ${SITE_NAME}`,
    description,
    authors: [{ name: AUTHOR_NAME }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: SITE_NAME,
      locale: "pt_BR",
      title: presentation.title,
      description,
      authors: [AUTHOR_NAME],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: presentation.title,
      description,
      images: [image],
    },
  };
}

/**
 * Title size for the 1200×630 card. Short titles go as large as the column
 * allows so they stay readable in a chat thumbnail; long ones step down to fit
 * in four lines.
 */
export function ogTitleFontSize(title: string): number {
  const length = title.length;
  if (length <= 24) return 92;
  if (length <= 40) return 78;
  if (length <= 60) return 66;
  return 56;
}
