"use client";

import { useEffect, useState } from "react";
import type { LiveClientState, PresenterControls } from "@repo/types";
import type { PlayerSlide } from "../navigation";
import { PresenterView } from "../presenter-view";
import type { SlideContext } from "../slide-renderer";
import { isIgnoredKeyEvent } from "../use-deck-navigation";
import { LaserSurface } from "./laser-surface";
import { LivePresenterPanel } from "./live-presenter-panel";
import { PointerLayer } from "./pointer-layer";

/**
 * The presenter window (opened with `P`): the 3a presenter view plus the live
 * panel and a laser on the current-slide preview. Slide changes travel to the
 * player window over BroadcastChannel; that window broadcasts them.
 */
export function LivePresenterView({
  presentationId,
  title,
  slides,
  context,
  live,
  controls,
}: {
  presentationId: string;
  title: string;
  slides: PlayerSlide[];
  context?: SlideContext;
  live: LiveClientState;
  controls: PresenterControls;
}) {
  const [laserOn, setLaserOn] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isIgnoredKeyEvent(event)) return;
      if (event.key === "l" || event.key === "L") setLaserOn((on) => !on);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const overlay = live.isLive ? (
    laserOn ? <LaserSurface onMove={controls.movePointer} /> : <PointerLayer pointer={live.pointer} />
  ) : undefined;

  return (
    <PresenterView
      presentationId={presentationId}
      title={title}
      slides={slides}
      context={context}
      overlay={overlay}
      livePanel={
        <LivePresenterPanel
          live={live}
          controls={controls}
          laser={{ on: laserOn, toggle: () => setLaserOn((on) => !on) }}
        />
      }
    />
  );
}
