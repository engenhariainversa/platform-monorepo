/**
 * Client-side auth-token cookie helpers. The token is persisted in a cookie so
 * the Apollo client (via `ApolloWrapper`) can attach it as a Bearer header on
 * every request. Browser-only — no-ops during SSR where `document` is absent.
 */

/** Default cookie name used by the CMS; overridable per call. */
export const AUTH_COOKIE_NAME = "cms_token";

const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export function getAuthToken(
  cookieName: string = AUTH_COOKIE_NAME,
): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function setAuthToken(
  token: string,
  cookieName: string = AUTH_COOKIE_NAME,
  maxAgeSeconds: number = DEFAULT_MAX_AGE,
): void {
  if (typeof document === "undefined") return;
  document.cookie = `${cookieName}=${encodeURIComponent(token)}; path=/; max-age=${maxAgeSeconds}; SameSite=Strict`;
}

export function clearAuthToken(cookieName: string = AUTH_COOKIE_NAME): void {
  if (typeof document === "undefined") return;
  document.cookie = `${cookieName}=; path=/; max-age=0`;
}

export function hasAuthToken(cookieName: string = AUTH_COOKIE_NAME): boolean {
  return !!getAuthToken(cookieName);
}
