"use client";

import Link from "next/link";
import { SlideRenderer, visibleSlides } from "@repo/ui";
import { getUploadUrl } from "@repo/graphql";
import type { Presentation } from "@repo/types";
import { relativeTime } from "../../lib/relative-time";

const VISIBILITY_LABEL = { PUBLIC: "Pública", PRIVATE: "Privada", MEMBERS: "Membros" } as const;
const VISIBILITY_CLASS = {
  PUBLIC: "bg-primary/15 text-primary",
  PRIVATE: "bg-surface-container-high text-on-surface-variant",
  MEMBERS: "bg-tertiary/15 text-tertiary",
} as const;

export type PresentationCardActions = {
  onDuplicate: () => void;
  onCopyLink: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPurge: () => void;
};

export function PresentationCard({ presentation, inTrash, actions }: {
  presentation: Presentation;
  inTrash: boolean;
  actions: PresentationCardActions;
}) {
  const first = visibleSlides(presentation.slides)[0];
  const button = "text-xs px-2 py-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface";

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden flex flex-col">
      <div className="pointer-events-none">
        {first ? (
          <SlideRenderer template={first.template} content={first.content} context={{ resolveUrl: (u) => getUploadUrl(u) }} />
        ) : (
          <div className="aspect-video flex items-center justify-center text-sm text-on-surface-variant">Sem slides</div>
        )}
      </div>
      <div className="p-4 space-y-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-headline font-bold text-on-surface leading-tight">{presentation.title}</h2>
          <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ${VISIBILITY_CLASS[presentation.visibility]}`}>
            {VISIBILITY_LABEL[presentation.visibility]}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant">
          {presentation.slideCount} slides · editada {relativeTime(presentation.updatedAt)}
        </p>
      </div>
      <div className="border-t border-outline-variant px-2 py-2 flex flex-wrap gap-1">
        {inTrash ? (
          <>
            <button onClick={actions.onRestore} className={button}>Restaurar</button>
            <button onClick={actions.onPurge} className={`${button} text-error hover:text-error`}>Excluir definitivamente</button>
          </>
        ) : (
          <>
            <Link href={`/dashboard/presentations/${presentation.id}`} className={button}>Editar</Link>
            <a href={`/apresentar/${presentation.id}`} target="_blank" rel="noreferrer" className={button}>Apresentar</a>
            <button onClick={actions.onDuplicate} className={button}>Duplicar</button>
            {presentation.visibility === "PUBLIC" && (
              <button onClick={actions.onCopyLink} className={button}>Copiar link público</button>
            )}
            <button onClick={actions.onTrash} className={`${button} hover:text-error`}>Mover para a lixeira</button>
          </>
        )}
      </div>
    </div>
  );
}
