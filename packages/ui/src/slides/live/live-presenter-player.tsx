"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveClientState, PresenterControls } from "@repo/types";
import type { PlayerSlide } from "../navigation";
import { PresentationPlayer } from "../player";
import type { SlideContext } from "../slide-renderer";
import { isIgnoredKeyEvent } from "../use-deck-navigation";
import { LaserSurface } from "./laser-surface";
import { PointerLayer } from "./pointer-layer";
import { ReactionsLayer } from "./reactions-layer";
import { absorbEcho, type SentSlide } from "./remote-slide";

/**
 * The projected screen of a presenter (CMS `/apresentar/[id]` and the presenter
 * link page): the 3a player plus "Iniciar ao vivo", slide broadcasting, the
 * laser and on-screen reactions.
 */
export function LivePresenterPlayer({
  presentationId,
  slides,
  context,
  presenterHref,
  isPublic,
  live,
  controls,
}: {
  presentationId: string;
  slides: PlayerSlide[];
  context?: SlideContext;
  presenterHref?: string;
  /** Only PUBLIC presentations can go live. */
  isPublic: boolean;
  live: LiveClientState;
  controls: PresenterControls;
}) {
  const [laserOn, setLaserOn] = useState(false);
  const [followSlideId, setFollowSlideId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const liveRef = useRef(live);
  liveRef.current = live;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const currentSlide = useRef<PlayerSlide | null>(null);
  const sent = useRef<SentSlide[]>([]);
  const firstReport = useRef(true);
  /** This window should keep the session alive (re-assert after a backend restart). */
  const wantLive = useRef(false);

  // A slide change from the server: another controller's command, or our own echo.
  useEffect(() => {
    if (!live.isLive || !live.slideId) return;
    const result = absorbEcho(live.slideId, sent.current, Date.now());
    sent.current = result.sent;
    if (result.apply) setFollowSlideId(live.slideId);
  }, [live.isLive, live.slideId]);

  useEffect(() => {
    if (live.isLive) wantLive.current = true;
  }, [live.isLive]);

  // Someone ended the session on purpose: do not resurrect it.
  useEffect(() => {
    wantLive.current = false;
  }, [live.endedSeq]);

  // The backend lost the session (restart): the presenter is the source of truth.
  useEffect(() => {
    if (live.lostSeq === 0 || !wantLive.current || !currentSlide.current) return;
    void controlsRef.current.start(currentSlide.current.id).catch(() => {});
  }, [live.lostSeq]);

  const handleSlideChange = (_index: number, slide: PlayerSlide) => {
    currentSlide.current = slide;
    // Local navigation releases the follow target, so the same remote slide can be applied again later.
    setFollowSlideId((target) => (target === slide.id ? target : null));

    // The slide the page opened on is not a command: a reloaded presenter adopts the live slide instead.
    if (firstReport.current) {
      firstReport.current = false;
      return;
    }
    const current = liveRef.current;
    if (!current.isLive || slide.id === current.slideId) return;
    sent.current = [...sent.current, { id: slide.id, at: Date.now() }];
    controlsRef.current.setSlide(slide.id);
  };

  const toggleLive = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (liveRef.current.isLive) {
        wantLive.current = false;
        await controls.stop();
      } else if (currentSlide.current) {
        await controls.start(currentSlide.current.id);
        wantLive.current = true;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar a transmissão");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isIgnoredKeyEvent(event)) return;
      if (event.key === "l" || event.key === "L") setLaserOn((on) => !on);
      if ((event.key === "r" || event.key === "R") && liveRef.current.isLive) {
        controlsRef.current.setOptions({ showReactionsOnScreen: !liveRef.current.showReactionsOnScreen });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const button = "rounded px-2 py-1 hover:bg-surface-container-high disabled:opacity-50";
  const toolbar = (
    <>
      {live.isLive && (
        <span className="flex items-center gap-2 font-bold" title="Espectadores agora">
          <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
          AO VIVO · 👁 {live.viewerCount ?? 0}
        </span>
      )}
      <button
        type="button"
        onClick={toggleLive}
        disabled={busy || (!isPublic && !live.isLive)}
        className={button}
        title={isPublic ? "Transmitir slide, laser e reações para o link público" : "Torne a apresentação pública para transmitir"}
      >
        {live.isLive ? "Encerrar" : "Iniciar ao vivo"}
      </button>
      {live.isLive && (
        <button type="button" onClick={() => setLaserOn((on) => !on)} className={button} title="Laser (L)">
          {laserOn ? "Laser ligado" : "Laser"}
        </button>
      )}
      {error && <span className="text-error">{error}</span>}
    </>
  );

  const overlay = live.isLive ? (
    <>
      {/* With the laser on, this window draws its own dot; otherwise it mirrors the other controller's. */}
      {laserOn ? <LaserSurface onMove={controls.movePointer} /> : <PointerLayer pointer={live.pointer} />}
      {live.showReactionsOnScreen && <ReactionsLayer lastReactions={live.lastReactions} />}
    </>
  ) : undefined;

  return (
    <PresentationPlayer
      presentationId={presentationId}
      slides={slides}
      context={context}
      presenterHref={presenterHref}
      onSlideChange={handleSlideChange}
      followSlideId={followSlideId}
      toolbar={toolbar}
      overlay={overlay}
    />
  );
}
