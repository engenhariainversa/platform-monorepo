"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { SlideRenderer, type SlideContext } from "./slide-renderer";
import { PIPELINE_GRADIENT } from "./canvas";
import { visibleSlides, type PlayerSlide } from "./navigation";
import { isIgnoredKeyEvent, navActionForKey, useDeckNavigation } from "./use-deck-navigation";

export type PresentationPlayerProps = {
  presentationId: string;
  slides: PlayerSlide[];
  context?: SlideContext;
  /** When set, `P` opens this route in a second window (presenter view). */
  presenterHref?: string;
  onSlideChange?: (index: number, slide: PlayerSlide) => void;
  overlay?: ReactNode;
  toolbar?: ReactNode;
};

const SWIPE_THRESHOLD = 50;

export function PresentationPlayer({
  presentationId,
  slides,
  context,
  presenterHref,
  onSlideChange,
  overlay,
  toolbar,
}: PresentationPlayerProps) {
  const shown = useMemo(() => visibleSlides(slides), [slides]);
  const { index, count, dispatch } = useDeckNavigation(presentationId, shown.length);
  const rootRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const onSlideChangeRef = useRef(onSlideChange);
  onSlideChangeRef.current = onSlideChange;
  const touchStartX = useRef<number | null>(null);

  const current = shown[index];

  useEffect(() => {
    if (current) onSlideChangeRef.current?.(index, current);
  }, [index, current]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen();
  };

  const openPresenter = () => {
    if (!presenterHref) return;
    window.open(
      `${presenterHref}#${indexRef.current + 1}`,
      `presenter-${presentationId}`,
      "popup,width=1280,height=800",
    );
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = navActionForKey(event);
      if (action) {
        event.preventDefault();
        dispatch(action);
        return;
      }
      if (isIgnoredKeyEvent(event)) return;
      if (event.key === "f" || event.key === "F") toggleFullscreen();
      if ((event.key === "p" || event.key === "P") && presenterHref) openPresenter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenterHref, presentationId]);

  if (!current) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-container-lowest text-on-surface-variant">
        Esta apresentação não tem slides visíveis.
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="group relative flex h-screen w-screen items-center justify-center overflow-hidden bg-surface-container-lowest"
    >
      {/* Letterboxed 16:9 stage: as wide as the viewport allows. */}
      <div
        className="relative cursor-pointer select-none"
        style={{ width: "min(100vw, calc(100vh * 16 / 9))" }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          dispatch({ type: event.clientX - rect.left < rect.width / 2 ? "prev" : "next" });
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start === null || end === undefined) return;
          if (end - start > SWIPE_THRESHOLD) dispatch({ type: "prev" });
          else if (start - end > SWIPE_THRESHOLD) dispatch({ type: "next" });
        }}
      >
        <SlideRenderer
          template={current.template}
          content={current.content}
          slideNumber={index + 1}
          context={context}
          overlay={overlay}
        />
      </div>

      {/* Toolbar: visible on hover, never part of the click-to-navigate area. */}
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-surface-container/90 px-3 py-2 text-sm text-on-surface opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <span className="font-code tabular-nums text-on-surface-variant">
          {index + 1} / {count}
        </span>
        {toolbar}
        {presenterHref && (
          <button type="button" onClick={openPresenter} className="rounded px-2 py-1 hover:bg-surface-container-high" title="Visão do apresentador (P)">
            Apresentador
          </button>
        )}
        <button type="button" onClick={toggleFullscreen} className="rounded px-2 py-1 hover:bg-surface-container-high" title="Tela cheia (F)">
          Tela cheia
        </button>
      </div>

      {/* Progress */}
      <div className="absolute bottom-0 left-0 h-[3px] transition-[width] duration-300" style={{ width: `${((index + 1) / count) * 100}%`, background: PIPELINE_GRADIENT }} />
    </div>
  );
}
