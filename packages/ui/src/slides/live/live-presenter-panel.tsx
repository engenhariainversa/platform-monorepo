"use client";

import { useEffect, useState } from "react";
import { REACTION_KINDS, type LiveClientState, type PresenterControls } from "@repo/types";
import { formatElapsed } from "../navigation";
import { REACTION_EMOJI } from "./emoji";
import { ReactionsLayer } from "./reactions-layer";

/** The live block of the presenter view: badge, audience, reactions and the two toggles. */
export function LivePresenterPanel({
  live,
  controls,
  laser,
}: {
  live: LiveClientState;
  controls: PresenterControls;
  laser?: { on: boolean; toggle: () => void };
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!live.isLive) {
    return (
      <div className="rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant">
        Fora do ar. Inicie a transmissão na janela dos slides ("Iniciar ao vivo").
      </div>
    );
  }

  const elapsed = live.startedAt ? Math.max(0, now - new Date(live.startedAt).getTime()) : 0;
  const toggle = "flex items-center gap-2 text-sm text-on-surface";

  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-container p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
          AO VIVO
          <span className="font-code font-normal tabular-nums text-on-surface-variant">{formatElapsed(elapsed)}</span>
        </span>
        <span className="font-code text-sm tabular-nums text-on-surface-variant">
          👁 {live.viewerCount ?? 0} agora · pico {live.peakViewers ?? 0}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 font-code text-sm tabular-nums">
        {REACTION_KINDS.map((kind) => (
          <span key={kind} title={kind}>
            {REACTION_EMOJI[kind]} {live.reactionTotals[kind]}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <label className={toggle}>
          <input
            type="checkbox"
            checked={live.showViewerCount}
            onChange={(e) => controls.setOptions({ showViewerCount: e.target.checked })}
          />
          Mostrar contador ao público
        </label>
        <label className={toggle}>
          <input
            type="checkbox"
            checked={live.showReactionsOnScreen}
            onChange={(e) => controls.setOptions({ showReactionsOnScreen: e.target.checked })}
          />
          Reações na tela projetada (R)
        </label>
        {laser && (
          <label className={toggle}>
            <input type="checkbox" checked={laser.on} onChange={laser.toggle} />
            Laser (L)
          </label>
        )}
      </div>

      <ReactionsLayer lastReactions={live.lastReactions} fontSize={28} />
    </div>
  );
}
