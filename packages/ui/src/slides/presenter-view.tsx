"use client";

import { useEffect, useMemo, useState } from "react";
import { SlideRenderer, type SlideContext } from "./slide-renderer";
import { formatElapsed, visibleSlides, type PlayerSlide } from "./navigation";
import { navActionForKey, useDeckNavigation } from "./use-deck-navigation";

export type PresenterViewProps = {
  presentationId: string;
  title: string;
  slides: PlayerSlide[];
  context?: SlideContext;
};

export function PresenterView({ presentationId, title, slides, context }: PresenterViewProps) {
  const shown = useMemo(() => visibleSlides(slides), [slides]);
  const { index, count, dispatch } = useDeckNavigation(presentationId, shown.length);
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulated, setAccumulated] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = navActionForKey(event);
      if (action) {
        event.preventDefault();
        dispatch(action);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const elapsed = accumulated + (startedAt !== null ? now - startedAt : 0);
  const current = shown[index];
  const next = shown[index + 1];

  const start = () => {
    if (startedAt === null) setStartedAt(Date.now());
  };
  const pause = () => {
    if (startedAt === null) return;
    setAccumulated((total) => total + Date.now() - startedAt);
    setStartedAt(null);
  };
  const reset = () => {
    setStartedAt(null);
    setAccumulated(0);
  };

  return (
    <div className="flex h-screen flex-col gap-4 bg-surface-container-lowest p-6 text-on-surface">
      <header className="flex items-center justify-between">
        <h1 className="font-headline text-lg font-bold">{title}</h1>
        <div className="flex items-center gap-6 font-code tabular-nums">
          <span className="text-on-surface-variant">
            Slide {count === 0 ? 0 : index + 1} / {count}
          </span>
          <span className="text-2xl text-secondary">{formatElapsed(elapsed)}</span>
          <span className="text-on-surface-variant">
            {new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[2fr_1fr] gap-6">
        <section className="flex flex-col gap-2">
          <p className="font-label text-xs uppercase tracking-wider text-on-surface-variant">Atual</p>
          {current ? (
            <SlideRenderer template={current.template} content={current.content} slideNumber={index + 1} context={context} />
          ) : (
            <p className="text-on-surface-variant">Sem slides visíveis.</p>
          )}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => dispatch({ type: "prev" })} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm">← Anterior</button>
            <button type="button" onClick={() => dispatch({ type: "next" })} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary">Próximo →</button>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <div>
            <p className="mb-2 font-label text-xs uppercase tracking-wider text-on-surface-variant">Próximo</p>
            {next ? (
              <SlideRenderer template={next.template} content={next.content} slideNumber={index + 2} context={context} />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-outline-variant text-sm text-on-surface-variant">
                Fim da apresentação
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 font-label text-xs uppercase tracking-wider text-on-surface-variant">Anotações</p>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container p-4 text-lg leading-relaxed">
              {current?.notes?.trim() ? current.notes : <span className="text-on-surface-variant">Sem anotações neste slide.</span>}
            </div>
          </div>

          <div className="flex gap-2">
            {startedAt === null ? (
              <button type="button" onClick={start} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm">Iniciar cronômetro</button>
            ) : (
              <button type="button" onClick={pause} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm">Pausar</button>
            )}
            <button type="button" onClick={reset} className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high">Zerar</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
