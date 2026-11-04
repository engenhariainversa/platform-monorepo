export type SentSlide = { id: string; at: number };

/** How long a `setLiveSlide` we sent may still come back as a SLIDE event. */
export const ECHO_WINDOW_MS = 2000;

/**
 * A presenter window receives every SLIDE event, including the echoes of its
 * own commands. Applying a late echo would move the presenter back to a slide
 * they already left; each sent slide therefore absorbs one matching event.
 * Anything else comes from another controller (CMS + presenter link) and applies.
 */
export function absorbEcho(
  remoteSlideId: string,
  sent: SentSlide[],
  now: number,
): { apply: boolean; sent: SentSlide[] } {
  const recent = sent.filter((entry) => now - entry.at < ECHO_WINDOW_MS);
  const index = recent.findIndex((entry) => entry.id === remoteSlideId);
  if (index === -1) return { apply: true, sent: recent };
  return { apply: false, sent: [...recent.slice(0, index), ...recent.slice(index + 1)] };
}
