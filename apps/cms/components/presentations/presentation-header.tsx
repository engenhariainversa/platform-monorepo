"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isValidSlug } from "@repo/slides";
import type { Presentation, PresentationVisibility } from "@repo/types";
import { publicPresentationUrl } from "../../lib/landing-url";
import { inputClass } from "./field-input";

export type SaveStatus = "saved" | "saving" | "error" | "invalid";
const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Salvo",
  saving: "Salvando…",
  error: "Erro ao salvar",
  invalid: "Corrija os campos destacados",
};

export function PresentationHeader({ presentation, status, onSave, metaError }: {
  presentation: Presentation;
  status: SaveStatus;
  metaError: string;
  onSave: (input: { title?: string; slug?: string; visibility?: PresentationVisibility }) => void;
}) {
  const [title, setTitle] = useState(presentation.title);
  const [slug, setSlug] = useState(presentation.slug);
  const [copied, setCopied] = useState(false);

  useEffect(() => setTitle(presentation.title), [presentation.title]);
  useEffect(() => setSlug(presentation.slug), [presentation.slug]);

  const slugInvalid = !isValidSlug(slug);
  const link = "text-sm py-2 px-3 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/presentations" className="text-on-surface-variant hover:text-on-surface">← Apresentações</Link>
        <span className="text-outline-variant">/</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== presentation.title && onSave({ title: title.trim() })}
          className="flex-1 bg-transparent font-headline text-2xl font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        />
        <span className={`text-xs ${status === "saved" ? "text-on-surface-variant" : status === "saving" ? "text-secondary" : "text-error"}`}>
          {STATUS_TEXT[status]}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <label className="block text-xs text-on-surface-variant mb-1 font-label">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => !slugInvalid && slug !== presentation.slug && onSave({ slug })}
            className={`${inputClass} font-code`}
          />
        </div>
        <div className="w-44">
          <label className="block text-xs text-on-surface-variant mb-1 font-label">Visibilidade</label>
          <select
            value={presentation.visibility}
            onChange={(e) => onSave({ visibility: e.target.value as PresentationVisibility })}
            className={inputClass}
          >
            <option value="PUBLIC">Público</option>
            <option value="PRIVATE">Privado</option>
            <option value="MEMBERS" disabled>Membros (em breve)</option>
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <a href={`/apresentar/${presentation.id}`} target="_blank" rel="noreferrer" className="text-sm py-2 px-3 rounded-lg bg-primary text-on-primary font-bold">Apresentar</a>
          <a href={`/apresentar/${presentation.id}/print`} target="_blank" rel="noreferrer" className={link}>PDF</a>
          {presentation.visibility === "PUBLIC" && (
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(publicPresentationUrl(presentation.slug));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={link}
            >
              {copied ? "Link copiado!" : "Copiar link público"}
            </button>
          )}
        </div>
      </div>
      {slug !== presentation.slug && (
        <p className="text-xs text-secondary">
          {slugInvalid
            ? "Use letras minúsculas, números e hífens (ex.: minha-live-12)."
            : "Trocar o slug quebra os links já compartilhados."}
        </p>
      )}
      {metaError && <p className="text-xs text-error">{metaError}</p>}
    </div>
  );
}
