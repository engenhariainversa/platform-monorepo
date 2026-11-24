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
 * The version in a deck's image URL: its last update, which moves on every
 * edit, slide change, visibility change and trip to the trash. `null` when the
 * date does not parse (the URL then goes without one).
 */
export function presentationImageVersion(presentation: Presentation): string | null {
  const version = Date.parse(presentation.updatedAt);
  return Number.isNaN(version) ? null : String(version);
}

/**
 * Whether `?v=` names the deck's current version. The image route serves only
 * that one, so a copy cached under an older URL (say, from before the deck
 * turned private) is never refreshed, and a request for it is a 404.
 */
export function isCurrentImageVersion(presentation: Presentation, version: string | null): boolean {
  return version === presentationImageVersion(presentation);
}

/**
 * The image URL carries the deck's last update so scrapers that cache by URL
 * (WhatsApp, X) pick up a new card after the cover is edited, and so the
 * Cloudflare copy of a deck that turns private is never served again.
 */
export function presentationImageUrl(presentation: Presentation, base: string = siteUrl()): string {
  const version = presentationImageVersion(presentation);
  const suffix = version === null ? "" : `?v=${version}`;
  return `${presentationUrl(presentation.slug, base)}/og.png${suffix}`;
}

/**
 * Cache-Control of a public deck's card. Five minutes at the edge bounds how
 * long a deck that turns private can still show its title there; nothing in
 * the browser and no stale-while-revalidate, which would serve that title on
 * purpose after the change.
 */
export const DECK_CARD_CACHE = "public, max-age=0, s-maxage=300";

/** Fixed cards that say nothing about a deck. Paths outside /apresentacoes so no slug can shadow them. */
export const PRIVATE_CARD_PATH = "/og/apresentacao-privada.png";
export const PRESENTER_CARD_PATH = "/og/link-de-apresentador.png";

export const PRIVATE_COVER: CoverInfo = { label: null, title: "Apresentação privada", subtitle: null, date: null };
export const PRESENTER_COVER: CoverInfo = { label: null, title: "Link de apresentador", subtitle: null, date: null };

function fixedCard(title: string, description: string, imagePath: string, base: string): Metadata {
  const image = { url: `${base}${imagePath}`, ...OG_IMAGE_SIZE, type: "image/png", alt: `${title} — ${SITE_NAME}` };
  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    robots: { index: false, follow: false },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "pt_BR", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Metadata of the presenter link page. Its token is in the URL fragment, which no scraper sees. */
export function presenterLinkMetadata(base: string = siteUrl()): Metadata {
  return {
    ...fixedCard("Link de apresentador", `Controle de uma apresentação no ${SITE_NAME}.`, PRESENTER_CARD_PATH, base),
    referrer: "no-referrer",
  };
}

/**
 * Metadata for /apresentacoes/<slug>. A deck that is missing, not public or in
 * the trash is `null` here and gets the same fixed "Apresentação privada" card
 * either way: no title, no slug, no URL of its own, so the response says
 * nothing about a private deck — not even that it exists.
 */
export function presentationMetadata(presentation: Presentation | null, base: string = siteUrl()): Metadata {
  if (!presentation) {
    return fixedCard(
      PRIVATE_COVER.title,
      `Esta apresentação não está disponível publicamente no ${SITE_NAME}.`,
      PRIVATE_CARD_PATH,
      base,
    );
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
