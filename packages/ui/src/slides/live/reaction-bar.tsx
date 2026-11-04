"use client";

import { useState } from "react";
import { REACTION_KINDS, type ReactionKind } from "@repo/types";
import { REACTION_EMOJI } from "./emoji";

const LABEL: Record<ReactionKind, string> = {
  CLAP: "Palmas",
  FIRE: "Fogo",
  MIND_BLOWN: "Mente explodida",
  LAUGH: "Risada",
  HEART: "Coração",
  THINKING: "Pensando",
};

/** The audience's six reactions. Floats over the page (and fullscreen); collapsible. */
export function ReactionBar({
  onReact,
  hidden,
  onToggleHidden,
}: {
  onReact: (kind: ReactionKind) => void;
  /** Whether this viewer hid everyone's floating reactions (local preference). */
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const [open, setOpen] = useState(true);
  const button = "rounded-full px-2 py-1 text-2xl transition-transform hover:scale-125 active:scale-95";

  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-surface-container/90 px-3 py-2 shadow-lg backdrop-blur">
      {open &&
        REACTION_KINDS.map((kind) => (
          <button key={kind} type="button" className={button} onClick={() => onReact(kind)} aria-label={LABEL[kind]} title={LABEL[kind]}>
            {REACTION_EMOJI[kind]}
          </button>
        ))}
      {open && (
        <button
          type="button"
          onClick={onToggleHidden}
          className="ml-1 rounded-full px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high"
        >
          {hidden ? "Mostrar reações" : "Ocultar reações"}
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high"
        aria-expanded={open}
      >
        {open ? "Recolher" : "Reagir"}
      </button>
    </div>
  );
}
