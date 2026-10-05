"use client";

import { useState } from "react";
import { SlideRenderer } from "@repo/ui";
import { getUploadUrl } from "@repo/graphql";
import type { SlideDraft } from "./editor-drafts";

export function SlideList({ slides, selectedId, onSelect, onMove, onDuplicate, onToggleHidden, onDelete, onAdd }: {
  slides: SlideDraft[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onToggleHidden: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const b = "px-1 text-[11px] text-on-surface-variant hover:text-on-surface";

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          draggable
          onDragStart={() => setDragFrom(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i);
            setDragFrom(null);
          }}
          className={`rounded-lg border-2 p-1 cursor-pointer ${slide.id === selectedId ? "border-primary" : "border-transparent hover:border-outline-variant"} ${slide.hidden ? "opacity-40" : ""}`}
          onClick={() => onSelect(slide.id)}
        >
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-code text-on-surface-variant w-5 text-right">{i + 1}</span>
            <div className="flex-1 pointer-events-none">
              <SlideRenderer template={slide.template} content={slide.content} context={{ resolveUrl: (u) => getUploadUrl(u) }} />
            </div>
          </div>
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <button className={b} title="Subir" onClick={() => onMove(i, i - 1)}>↑</button>
            <button className={b} title="Descer" onClick={() => onMove(i, i + 1)}>↓</button>
            <button className={b} title="Duplicar" onClick={() => onDuplicate(i)}>⧉</button>
            <button className={b} title={slide.hidden ? "Mostrar" : "Ocultar"} onClick={() => onToggleHidden(i)}>{slide.hidden ? "◌" : "●"}</button>
            <button className={`${b} hover:text-error`} title="Excluir" onClick={() => onDelete(i)}>✕</button>
          </div>
        </div>
      ))}
      <button onClick={onAdd} className="rounded-lg border-2 border-dashed border-outline-variant py-3 text-sm text-on-surface-variant hover:border-primary hover:text-primary">
        + Slide
      </button>
    </div>
  );
}
