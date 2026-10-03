// Optional: only the dev compose sets it. Production falls back to the public
// domain, so no secret is needed.
export const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "https://engenhariainversa.com.br";

export function publicPresentationUrl(slug: string, base: string = LANDING_URL): string {
  return `${base.replace(/\/+$/, "")}/apresentacoes/${slug}`;
}
