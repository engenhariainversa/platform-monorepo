"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  graphqlRequest,
  uploadFile,
  getUploadUrl,
} from "../../../../lib/graphql-client";
import {
  GET_EPISODES,
  CREATE_EPISODE,
  UPDATE_EPISODE,
  DELETE_EPISODE,
  REORDER_EPISODES,
} from "../../../../lib/queries";

type Episode = {
  id: string;
  module: string;
  title: string;
  duration: string;
  imageUrl: string | null;
  order: number;
};

export default function EpisodesContentPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchEpisodes = async () => {
    try {
      const data = await graphqlRequest<{ episodes: Episode[] }>(GET_EPISODES);
      setEpisodes(data.episodes);
    } catch (err) {
      console.error("Failed to fetch episodes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, []);

  const handleCreate = async () => {
    if (episodes.length >= 4) return;
    try {
      const data = await graphqlRequest<{ createEpisode: Episode }>(
        CREATE_EPISODE,
        {
          input: {
            module: "MOD-XX • EP XX",
            title: "Novo Episódio",
            duration: "00:00",
          },
        },
      );
      setEpisodes([...episodes, data.createEpisode]);
      setEditing(data.createEpisode.id);
    } catch (err) {
      console.error("Failed to create", err);
    }
  };

  const handleUpdate = async (id: string, field: string, value: string) => {
    setSaving(id);
    try {
      const data = await graphqlRequest<{ updateEpisode: Episode }>(
        UPDATE_EPISODE,
        { id, input: { [field]: value } },
      );
      setEpisodes((prev) =>
        prev.map((ep) => (ep.id === id ? data.updateEpisode : ep)),
      );
    } catch (err) {
      console.error("Failed to update", err);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}"?`)) return;
    try {
      await graphqlRequest(DELETE_EPISODE, { id });
      setEpisodes((prev) => prev.filter((ep) => ep.id !== id));
      setEditing(null);
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= episodes.length) return;
    const newOrder = [...episodes];
    [newOrder[index], newOrder[newIndex]] = [
      newOrder[newIndex],
      newOrder[index],
    ];
    setEpisodes(newOrder);
    try {
      await graphqlRequest(REORDER_EPISODES, {
        ids: newOrder.map((ep) => ep.id),
      });
    } catch (err) {
      console.error("Failed to reorder", err);
      fetchEpisodes();
    }
  };

  const handleUpload = async (
    epId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(epId);
    try {
      const result = await uploadFile(file);
      await handleUpdate(epId, "imageUrl", result.url);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(null);
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
            Episódios Recentes
          </h1>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-on-surface-variant text-sm">
          {episodes.length}/4 episódios
        </p>
        <button
          onClick={handleCreate}
          disabled={episodes.length >= 4}
          className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Adicionar Episódio
        </button>
      </div>

      {/* Episodes List */}
      <div className="space-y-4">
        {episodes.map((ep, index) => (
          <div
            key={ep.id}
            className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden"
          >
            {/* Header row */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-surface-container-high transition-colors"
              onClick={() =>
                setEditing(editing === ep.id ? null : ep.id)
              }
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMove(index, -1);
                  }}
                  disabled={index === 0}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 text-xs"
                >
                  ▲
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMove(index, 1);
                  }}
                  disabled={index === episodes.length - 1}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 text-xs"
                >
                  ▼
                </button>
              </div>

              <div className="w-20 h-12 bg-surface-container-high rounded overflow-hidden flex-shrink-0">
                {ep.imageUrl ? (
                  <img
                    src={getUploadUrl(ep.imageUrl)}
                    alt={ep.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-on-surface-variant">
                    📷
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-code text-secondary">{ep.module}</p>
                <p className="text-sm font-bold text-on-surface truncate">
                  {ep.title}
                </p>
              </div>

              <span className="text-xs font-code text-on-surface-variant bg-surface-container-high px-2 py-1 rounded">
                {ep.duration}
              </span>

              <span className="text-on-surface-variant text-sm">
                {editing === ep.id ? "▼" : "▶"}
              </span>
            </div>

            {/* Edit Form */}
            {editing === ep.id && (
              <div className="border-t border-outline-variant p-5 space-y-4 bg-surface-container-lowest">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-on-surface-variant mb-1 font-label">
                      Módulo / Episódio
                    </label>
                    <input
                      type="text"
                      defaultValue={ep.module}
                      onBlur={(e) =>
                        handleUpdate(ep.id, "module", e.target.value)
                      }
                      className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm font-code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-on-surface-variant mb-1 font-label">
                      Duração
                    </label>
                    <input
                      type="text"
                      defaultValue={ep.duration}
                      onBlur={(e) =>
                        handleUpdate(ep.id, "duration", e.target.value)
                      }
                      className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm font-code"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-on-surface-variant mb-1 font-label">
                    Título
                  </label>
                  <input
                    type="text"
                    defaultValue={ep.title}
                    onBlur={(e) =>
                      handleUpdate(ep.id, "title", e.target.value)
                    }
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-on-surface-variant mb-1 font-label">
                    Imagem
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      defaultValue={ep.imageUrl || ""}
                      onBlur={(e) =>
                        handleUpdate(ep.id, "imageUrl", e.target.value)
                      }
                      className="flex-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm font-code"
                      placeholder="/uploads/..."
                    />
                    <input
                      type="file"
                      ref={(el) => { fileRefs.current[ep.id] = el; }}
                      onChange={(e) => handleUpload(ep.id, e)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileRefs.current[ep.id]?.click()}
                      disabled={uploading === ep.id}
                      className="bg-secondary/15 text-secondary font-bold px-4 py-2 rounded-lg text-sm hover:bg-secondary/25 disabled:opacity-50"
                    >
                      {uploading === ep.id ? "..." : "Upload"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  {saving === ep.id && (
                    <span className="text-xs text-primary">Salvando...</span>
                  )}
                  <span />
                  <button
                    onClick={() => handleDelete(ep.id, ep.title)}
                    className="text-xs text-error hover:bg-error/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Remover episódio
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {episodes.length === 0 && (
          <div className="bg-surface-container rounded-xl border border-outline-variant p-12 text-center">
            <span className="text-4xl mb-4 block">🎬</span>
            <p className="text-on-surface-variant">
              Nenhum episódio adicionado. Clique em &quot;Adicionar
              Episódio&quot; para começar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
