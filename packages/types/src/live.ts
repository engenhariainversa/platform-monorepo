export type LiveData = {
  // Absent until first saved (the CMS form starts empty).
  id?: string;
  label: string;
  title: string;
  description: string;
  // CTA label after the event has started.
  buttonText: string;
  // CTA label shown before the event starts.
  buttonTextBefore: string;
  buttonUrl: string;
  thumbnailUrl: string;
  isLive: boolean;
  viewersCount: string;
  // ISO-8601 UTC instant the live event starts (null until scheduled). The
  // landing shows the "live" badge once this instant is in the past.
  occursAt?: string | null;
  // IANA timezone the admin scheduled `occursAt` in (e.g. "America/Sao_Paulo"),
  // used only to re-render the local wall-clock time in the CMS form.
  occursAtTimezone?: string | null;
};

/** Shape accepted by the `upsertLive` mutation (no `id`). */
export type UpsertLiveInput = Omit<LiveData, "id">;
