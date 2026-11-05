/** sessionStorage key: a reload of the presenter page (or its popup) keeps working. */
export const PRESENTER_TOKEN_STORAGE_KEY = "ei_presenter_token";

/** `#t=eip_…` → the token. The fragment never reaches a server or an access log. */
export function extractPresenterToken(hash: string): string | null {
  return /^#t=(eip_[A-Za-z0-9_-]+)$/.exec(hash)?.[1] ?? null;
}

/** Forgets a dead link's token, so a reload does not retry it. */
export function clearPresenterToken(): void {
  try {
    sessionStorage.removeItem(PRESENTER_TOKEN_STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was stored by us.
  }
}
