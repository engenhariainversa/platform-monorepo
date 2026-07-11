"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@repo/graphql/react";
import {
  GET_LIVE,
  UPSERT_LIVE,
  uploadFile,
  getUploadUrl,
  type LiveData,
} from "@repo/graphql";

const emptyLive: LiveData = {
  label: "PRÓXIMA ETAPA DO PIPELINE",
  title: "",
  description: "",
  buttonText: "Entrar na Live",
  buttonUrl: "#",
  thumbnailUrl: "",
  isLive: false,
  viewersCount: "0",
};

export default function LiveContentPage() {
  const [live, setLive] = useState<LiveData>(emptyLive);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, loading } = useQuery<{ live: LiveData | null }>(GET_LIVE);

  useEffect(() => {
    if (data?.live) setLive(data.live);
  }, [data]);

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
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-on-primary font-bold px-6 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saved ? "✓ Salvo!" : saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-6">
          <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
            <h2 className="font-headline text-lg font-bold text-on-surface">
              Informações da Live
            </h2>

            {/* Status Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">Status</p>
                <p className="text-xs text-on-surface-variant">
                  Exibir badge &quot;AO VIVO&quot; na landing
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

          {/* CTA & Thumbnail */}
          <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
            <h2 className="font-headline text-lg font-bold text-on-surface">
              CTA & Thumbnail
            </h2>

            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Texto do Botão
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

        {/* Preview */}
        <div className="space-y-4">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Preview
          </h2>
          <div className="bg-surface-container-high rounded-xl overflow-hidden border border-outline-variant">
            <div className="aspect-video bg-surface-container relative overflow-hidden">
              {live.thumbnailUrl ? (
                <img
                  src={getUploadUrl(live.thumbnailUrl)}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm">
                  📷 Sem thumbnail
                </div>
              )}
              {live.isLive && (
                <div className="absolute top-3 left-3 bg-error text-white font-bold text-xs px-2 py-1 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  AO VIVO
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                👁 {live.viewersCount} assistindo
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="font-code text-xs text-primary">{live.label}</p>
              <h3 className="font-headline text-lg font-bold text-on-surface leading-tight">
                {live.title || "Título da Live"}
              </h3>
              <p className="text-on-surface-variant text-sm">
                {live.description || "Descrição..."}
              </p>
              <div className="inline-block bg-primary/20 text-primary font-bold text-sm px-4 py-2 rounded-lg">
                {live.buttonText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
