import type { Slide } from "@repo/types";

export type SlideDraft = {
  id: string;
  template: string;
  content: Record<string, unknown>;
  notes: string;
  hidden: boolean;
};

export function toDraft(slide: Slide): SlideDraft {
  return { id: slide.id, template: slide.template, content: slide.content, notes: slide.notes ?? "", hidden: slide.hidden };
}

/**
 * Server structure (order, added and removed slides) with local content kept
 * for slides that still have an unsaved edit.
 */
export function mergeDrafts(server: Slide[], local: SlideDraft[], pending: Set<string>): SlideDraft[] {
  const byId = new Map(local.map((d) => [d.id, d]));
  return [...server]
    .sort((a, b) => a.order - b.order)
    .map((slide) => {
      const mine = byId.get(slide.id);
      return mine && pending.has(slide.id) ? mine : toDraft(slide);
    });
}

export function moveId(ids: string[], from: number, to: number): string[] {
  if (to < 0 || to >= ids.length || from === to) return ids;
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
