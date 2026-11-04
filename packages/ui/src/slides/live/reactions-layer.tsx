"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveClientState } from "@repo/types";
import { REACTION_EMOJI } from "./emoji";
import { FLOAT_MS, addReactions, type FloatingReaction } from "./reaction-queue";

/**
 * Emojis rising from the bottom-right corner. Fill a `relative` box with it:
 * the canvas overlay (default 72px, canvas pixels) or a panel (pass `fontSize`).
 */
export function ReactionsLayer({
  lastReactions,
  fontSize = 72,
}: {
  lastReactions: LiveClientState["lastReactions"];
  fontSize?: number;
}) {
  const [items, setItems] = useState<FloatingReaction[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (!lastReactions) return;
    setItems((current) => addReactions(current, lastReactions.counts, Date.now(), () => nextId.current++));
  }, [lastReactions]);

  // Clear the stage once the last batch finished floating.
  useEffect(() => {
    if (items.length === 0) return;
    const id = window.setTimeout(
      () => setItems((current) => current.filter((item) => Date.now() - item.bornAt < FLOAT_MS)),
      FLOAT_MS,
    );
    return () => window.clearTimeout(id);
  }, [items]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes ei-reaction-rise {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { transform: translateY(-60%) scale(1); opacity: 1; }
          100% { transform: translateY(-480%) scale(1); opacity: 0; }
        }
      `}</style>
      {items.map((item) => (
        <span
          key={item.id}
          className="absolute bottom-[6%] flex items-center font-code text-on-surface"
          style={{
            // Spread across the corner so simultaneous reactions do not stack.
            right: `${3 + ((item.id * 37) % 16)}%`,
            fontSize,
            lineHeight: 1,
            animation: `ei-reaction-rise ${FLOAT_MS}ms ease-out forwards`,
          }}
        >
          {REACTION_EMOJI[item.kind]}
          {item.count > 1 && <span style={{ fontSize: fontSize * 0.5, marginLeft: fontSize * 0.1 }}>×{item.count}</span>}
        </span>
      ))}
    </div>
  );
}
