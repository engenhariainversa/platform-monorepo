// Decisions behind the editor's autosave and refetch, kept free of React so the
// races they guard against can be unit-tested.

export type SaveStatus = "saved" | "saving" | "error" | "invalid";

/**
 * Per-slide save bookkeeping. Every edit gets a sequence number; a save only
 * settles a slide when it carried that slide's latest edit, so an edit made
 * while a save was in flight (valid or not) is never dropped from `pending`.
 */
export class SaveTracker {
  private counter = 0;
  private readonly latest = new Map<string, number>();
  /** Slides whose local draft differs from what the server confirmed. */
  readonly pending = new Set<string>();
  readonly invalid = new Set<string>();
  readonly failed = new Set<string>();

  /** Records an edit and returns its sequence number. Editing a failed slide retries it. */
  edit(id: string, valid: boolean): number {
    const seq = ++this.counter;
    this.latest.set(id, seq);
    this.pending.add(id);
    this.failed.delete(id);
    if (valid) this.invalid.delete(id);
    else this.invalid.add(id);
    return seq;
  }

  saved(id: string, seq: number): void {
    if (this.latest.get(id) === seq) this.pending.delete(id);
  }

  failedSave(id: string, seq: number): void {
    if (this.latest.get(id) === seq) this.failed.add(id);
  }

  forget(id: string): void {
    this.latest.delete(id);
    this.pending.delete(id);
    this.invalid.delete(id);
    this.failed.delete(id);
  }

  clear(): void {
    this.latest.clear();
    this.pending.clear();
    this.invalid.clear();
    this.failed.clear();
  }

  /** error > invalid > saving > saved. */
  status(writesInFlight: number, structuralError: boolean): SaveStatus {
    if (structuralError || this.failed.size > 0) return "error";
    if (this.invalid.size > 0) return "invalid";
    if (writesInFlight > 0 || this.pending.size > 0) return "saving";
    return "saved";
  }
}

/**
 * A refetch result is applied only if it is newer than the last applied one and
 * no write of this tab started after it was requested (that write's own sync
 * will follow and carry the newer state).
 */
export function shouldApplySync(s: { seq: number; lastApplied: number; epochAtStart: number; epochNow: number }): boolean {
  return s.seq > s.lastApplied && s.epochAtStart === s.epochNow;
}

function isAfter(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return Number.isNaN(ta) || Number.isNaN(tb) ? a > b : ta > tb;
}

/** The later of two ISO timestamps; the known `updatedAt` never moves backwards. */
export function laterTimestamp(known: string | null, fresh: string): string {
  return known === null || isAfter(fresh, known) ? fresh : known;
}

/**
 * The external-change banner: the server moved past what this tab knows, and
 * this tab had no write in flight (or starting) around the check, so the change
 * cannot be its own commit whose sync has not landed yet.
 */
export function shouldShowBanner(s: {
  fresh: string;
  known: string | null;
  writesInFlightAtStart: number;
  writesInFlightNow: number;
  epochAtStart: number;
  epochNow: number;
}): boolean {
  if (s.known === null) return false;
  if (s.writesInFlightAtStart > 0 || s.writesInFlightNow > 0 || s.epochAtStart !== s.epochNow) return false;
  return isAfter(s.fresh, s.known);
}
