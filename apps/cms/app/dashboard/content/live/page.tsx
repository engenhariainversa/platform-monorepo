"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@repo/graphql/react";
import { GET_LIVE, UPSERT_LIVE, uploadFile, getUploadUrl } from "@repo/graphql";
import { LiveCard, formatLiveDate } from "@repo/ui";
import type { LiveData } from "@repo/types";
import {
  TIMEZONE_OPTIONS,
  DEFAULT_TIMEZONE,
  getBrowserTimezone,
  zonedInputToUtcIso,
  utcIsoToZonedInput,
} from "./datetime";

const emptyLive: LiveData = {
  label: "PRÓXIMA ETAPA DO PIPELINE",
  title: "",
  description: "",
  buttonText: "Entrar na Live",
  buttonTextBefore: "Ativar lembrete",
  buttonUrl: "#",
  thumbnailUrl: "",
  isLive: false,
  viewersCount: "0",
  occursAt: null,
  occursAtTimezone: null,
};

export default function LiveContentPage() {
  const [live, setLive] = useState<LiveData>(emptyLive);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "mobile",
  );
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, loading } = useQuery<{ live: LiveData | null }>(GET_LIVE);

  useEffect(() => {
    if (data?.live) {
      setLive(data.live);
      setTimezone(data.live.occursAtTimezone || getBrowserTimezone());
    } else {
      setTimezone(getBrowserTimezone());
    }
  }, [data]);

  // While the preview modal is open: close on Escape and freeze the dashboard's
  // scroll container (the layout scrolls inside <main>, not the body).
  useEffect(() => {
    if (!showPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPreview(false);
    };
    window.addEventListener("keydown", onKey);

    const main = document.querySelector("main");
    const previousOverflow = main?.style.overflow ?? "";
    if (main) main.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      if (main) main.style.overflow = previousOverflow;
    };
  }, [showPreview]);

  // The event start is edited as a wall-clock value in `timezone` but stored as
  // a UTC instant. Both handlers keep `occursAt`/`occursAtTimezone` in sync.
  const handleOccursAtChange = (datetimeLocal: string) => {
    const iso = zonedInputToUtcIso(datetimeLocal, timezone);
    setLive({ ...live, occursAt: iso, occursAtTimezone: iso ? timezone : null });
  };

  const handleTimezoneChange = (tz: string) => {
    // Preserve the wall-clock time the admin is looking at, re-anchoring it to
    // the newly chosen zone.
    const wall = utcIsoToZonedInput(live.occursAt, timezone);
    const iso = zonedInputToUtcIso(wall, tz);
    setTimezone(tz);
    setLive({ ...live, occursAt: iso, occursAtTimezone: iso ? tz : null });
  };

  // Effective landing status: once scheduled, the occur date drives the "live"
  // badge; the manual toggle is only a fallback when no date is set.
  const hasStarted = live.occursAt
    ? new Date(live.occursAt).getTime() <= Date.now()
    : live.isLive;

  // Props mirroring exactly what the landing feeds its <LiveCard>, so the
  // preview is a 1:1 render of the real component.
  const previewProps = {
    label: live.label,
    title: live.title || "Título da Live",
    description: live.description || "Descrição...",
    ctaLabel: hasStarted ? live.buttonText : live.buttonTextBefore,
    buttonUrl: live.buttonUrl,
    thumbnailSrc: live.thumbnailUrl ? getUploadUrl(live.thumbnailUrl) : undefined,
    isLiveNow: hasStarted,
    occursLabel: formatLiveDate(live.occursAt, timezone),
    viewersCount: live.viewersCount,
  };

  const [upsertLive, { loading: saving }] = useMutation<{
    upsertLive: LiveData;
  }>(UPSERT_LIVE);

  const handleSave = async () => {
    try {
      // Drop `id` (a read-only field); `__typename` is stripped globally by the
      // Apollo client's removeTypenameFromVariables link.
      const { id, ...input } = live;
      const { data: result } = await upsertLive({ variables: { input } });
      if (result?.upsertLive) {
        setLive(result.upsertLive);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      setLive({ ...live, thumbnailUrl: result.url });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/content"
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            ← Conteúdo
          </Link>
          <span className="text-outline-variant">/</span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Live
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="border border-outline-variant text-on-surface font-bold px-6 py-2 rounded-lg text-sm hover:bg-surface-container-high transition-colors"
          >
            👁 Visualizar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-on-primary font-bold px-6 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saved ? "✓ Salvo!" : saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Form (full width) */}
      <div className="space-y-6">
        <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Informações da Live
          </h2>

            {/* Status Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">Status manual</p>
                <p className="text-xs text-on-surface-variant">
                  Usado apenas quando não há data agendada abaixo
                </p>
              </div>
              <button
                onClick={() => setLive({ ...live, isLive: !live.isLive })}
                className={`w-12 h-6 rounded-full transition-colors relative ${live.isLive ? "bg-error" : "bg-outline-variant"
                  }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${live.isLive ? "left-[26px]" : "left-0.5"
                    }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Label / Categoria
              </label>
              <input
                type="text"
                value={live.label}
                onChange={(e) => setLive({ ...live, label: e.target.value })}
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Título
              </label>
              <input
                type="text"
                value={live.title}
                onChange={(e) => setLive({ ...live, title: e.target.value })}
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Descrição
              </label>
              <textarea
                value={live.description}
                onChange={(e) =>
                  setLive({ ...live, description: e.target.value })
                }
                rows={3}
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Espectadores (texto exibido)
              </label>
              <input
                type="text"
                value={live.viewersCount}
                onChange={(e) =>
                  setLive({ ...live, viewersCount: e.target.value })
                }
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Scheduling */}
          <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
            <div>
              <h2 className="font-headline text-lg font-bold text-on-surface">
                Agendamento
              </h2>
              <p className="text-xs text-on-surface-variant mt-1">
                A badge &quot;AO VIVO&quot; aparece automaticamente na landing
                quando a data/hora abaixo for atingida.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Data e hora do evento
                </label>
                <input
                  type="datetime-local"
                  value={utcIsoToZonedInput(live.occursAt, timezone)}
                  onChange={(e) => handleOccursAtChange(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Fuso horário
                </label>
                <select
                  value={timezone}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {live.occursAt && (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span
                  className={`font-bold px-2 py-1 rounded ${
                    hasStarted
                      ? "bg-error/20 text-error"
                      : "bg-secondary/20 text-secondary"
                  }`}
                >
                  {hasStarted ? "● Ao vivo agora" : "○ Agendada"}
                </span>
                <button
                  onClick={() =>
                    setLive({
                      ...live,
                      occursAt: null,
                      occursAtTimezone: null,
                    })
                  }
                  className="text-on-surface-variant hover:text-error transition-colors"
                >
                  Limpar agendamento
                </button>
              </div>
            )}
          </div>

          {/* CTA & Thumbnail */}
          <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
            <h2 className="font-headline text-lg font-bold text-on-surface">
              CTA & Thumbnail
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Texto do Botão (antes da live)
                </label>
                <input
                  type="text"
                  value={live.buttonTextBefore}
                  onChange={(e) =>
                    setLive({ ...live, buttonTextBefore: e.target.value })
                  }
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Texto do Botão (ao vivo)
                </label>
                <input
                  type="text"
                  value={live.buttonText}
                  onChange={(e) =>
                    setLive({ ...live, buttonText: e.target.value })
                  }
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                URL do Botão
              </label>
              <input
                type="url"
                value={live.buttonUrl}
                onChange={(e) =>
                  setLive({ ...live, buttonUrl: e.target.value })
                }
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm font-code"
              />
            </div>

            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Thumbnail
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={live.thumbnailUrl}
                  onChange={(e) =>
                    setLive({ ...live, thumbnailUrl: e.target.value })
                  }
                  className="flex-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm font-code"
                  placeholder="/uploads/..."
                />
                <input
                  type="file"
                  ref={fileRef}
                  onChange={handleUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="bg-secondary/15 text-secondary font-bold px-4 py-2 rounded-lg text-sm hover:bg-secondary/25 disabled:opacity-50"
                >
                  {uploading ? "Enviando..." : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Preview modal — renders the real landing <LiveCard> at the chosen device */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-surface-container-low rounded-2xl border border-outline-variant w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between gap-3 p-4 border-b border-outline-variant sticky top-0 bg-surface-container-low rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <h2 className="font-headline text-lg font-bold text-on-surface">
                  Preview
                </h2>
                <div className="flex gap-1 bg-surface-container-high rounded-lg p-1">
                  {(["desktop", "mobile"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setPreviewDevice(d)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        previewDevice === d
                          ? "bg-primary text-on-primary"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {d === "desktop" ? "🖥 Desktop" : "📱 Mobile"}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                aria-label="Fechar preview"
                className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6">
              {previewDevice === "mobile" ? (
                <div className="mx-auto w-[360px] max-w-full">
                  <LiveCard device="mobile" preview {...previewProps} />
                </div>
              ) : (
                // Desktop layout needs width; scroll horizontally on small
                // screens so the side-by-side proportions stay faithful.
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    <LiveCard device="desktop" preview {...previewProps} />
                  </div>
                </div>
              )}
              <p className="text-xs text-on-surface-variant mt-4 text-center">
                Prévia do componente real da landing. A badge alterna entre a
                data agendada e &quot;AO VIVO&quot; conforme o horário do evento.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
