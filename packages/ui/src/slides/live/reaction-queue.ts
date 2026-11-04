import type { ReactionCount, ReactionKind } from "@repo/types";

export type FloatingReaction = { id: number; kind: ReactionKind; count: number; bornAt: number };

/** Single emojis on screen at once; what does not fit is grouped as "🔥×12". */
export const MAX_FLOATING = 20;
export const FLOAT_MS = 2500;

export function addReactions(
  current: FloatingReaction[],
  counts: ReactionCount[],
  now: number,
  nextId: () => number,
): FloatingReaction[] {
  // Copies: a carried-over group is updated below, and `current` must stay untouched.
  const items = current.filter((item) => now - item.bornAt < FLOAT_MS).map((item) => ({ ...item }));
  for (const { kind, count } of counts) {
    const singlesOnScreen = items.filter((item) => item.count === 1).length;
    const singles = Math.min(count, Math.max(0, MAX_FLOATING - singlesOnScreen));
    for (let i = 0; i < singles; i++) items.push({ id: nextId(), kind, count: 1, bornAt: now });

    const overflow = count - singles;
    if (overflow <= 0) continue;
    const group = items.find((item) => item.kind === kind && item.count > 1);
    if (group) {
      group.count += overflow;
      group.bornAt = now;
    } else {
      items.push({ id: nextId(), kind, count: overflow, bornAt: now });
    }
  }
  return items;
}
