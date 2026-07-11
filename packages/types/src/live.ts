export type LiveData = {
  // Absent until first saved (the CMS form starts empty).
  id?: string;
  label: string;
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  thumbnailUrl: string;
  isLive: boolean;
  viewersCount: string;
};

/** Shape accepted by the `upsertLive` mutation (no `id`). */
export type UpsertLiveInput = Omit<LiveData, "id">;
