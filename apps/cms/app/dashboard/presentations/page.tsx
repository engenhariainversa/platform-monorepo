"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@repo/graphql/react";
import {
  CREATE_PRESENTATION,
  DELETE_PRESENTATION,
  DUPLICATE_PRESENTATION,
  GET_PRESENTATIONS,
  PURGE_PRESENTATION,
  RESTORE_PRESENTATION,
} from "@repo/graphql";
import type { Presentation } from "@repo/types";
import { PresentationCard } from "../../../components/presentations/presentation-card";
import { PurgeDialog } from "../../../components/presentations/purge-dialog";
import { starterSlides } from "../../../lib/new-presentation";
import { publicPresentationUrl } from "../../../lib/landing-url";

type Tab = "all" | "public" | "private" | "trash";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "public", label: "Públicas" },
  { key: "private", label: "Privadas" },
  { key: "trash", label: "Lixeira" },
];

export default function PresentationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [newTitle, setNewTitle] = useState<string | null>(null);
  const [purging, setPurging] = useState<Presentation | null>(null);

  const { data, loading, refetch } = useQuery<{ presentations: Presentation[] }>(GET_PRESENTATIONS, {
    variables: { trash: tab === "trash" },
    fetchPolicy: "cache-and-network",
  });
  const refresh = { refetchQueries: [GET_PRESENTATIONS] };
  const [createPresentation, { loading: creating }] = useMutation<{ createPresentation: Presentation }>(CREATE_PRESENTATION);
  const [duplicatePresentation] = useMutation(DUPLICATE_PRESENTATION, refresh);
  const [deletePresentation] = useMutation(DELETE_PRESENTATION, refresh);
  const [restorePresentation] = useMutation(RESTORE_PRESENTATION, refresh);
  const [purgePresentation] = useMutation(PURGE_PRESENTATION, refresh);

  const all = data?.presentations ?? [];
  const shown =
    tab === "public" ? all.filter((p) => p.visibility === "PUBLIC")
    : tab === "private" ? all.filter((p) => p.visibility !== "PUBLIC")
    : all;

  const run = async (action: () => Promise<unknown>, failure: string) => {
    try {
      await action();
      await refetch();
    } catch (err) {
      console.error(failure, err);
      alert(err instanceof Error ? err.message : failure);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = (newTitle ?? "").trim();
    if (!title) return;
    try {
      const { data: result } = await createPresentation({
        variables: { input: { title, slides: starterSlides(title) } },
      });
      if (result?.createPresentation) router.push(`/dashboard/presentations/${result.createPresentation.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar a apresentação");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Apresentações</h1>
          <p className="text-on-surface-variant text-sm mt-1">Seu acervo de apresentações</p>
        </div>
        <button onClick={() => setNewTitle("")} className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90">
          Nova apresentação
        </button>
      </div>

      <div className="flex gap-1 border-b border-outline-variant">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary font-bold" : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && all.length === 0 ? (
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      ) : shown.length === 0 ? (
        <p className="text-on-surface-variant text-sm">
          {tab === "trash" ? "A lixeira está vazia." : "Nenhuma apresentação aqui ainda."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {shown.map((p) => (
            <PresentationCard
              key={p.id}
              presentation={p}
              inTrash={tab === "trash"}
              actions={{
                onDuplicate: () => run(() => duplicatePresentation({ variables: { id: p.id } }), "Erro ao duplicar"),
                onCopyLink: () => void navigator.clipboard.writeText(publicPresentationUrl(p.slug)),
                onTrash: () => {
                  if (confirm(`Mover "${p.title}" para a lixeira?`)) {
                    void run(() => deletePresentation({ variables: { id: p.id } }), "Erro ao mover para a lixeira");
                  }
                },
                onRestore: () => run(() => restorePresentation({ variables: { id: p.id } }), "Erro ao restaurar"),
                onPurge: () => setPurging(p),
              }}
            />
          ))}
        </div>
      )}

      {newTitle !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleCreate} className="w-full max-w-md bg-surface-container rounded-xl border border-outline-variant p-6 space-y-4">
            <h2 className="font-headline text-lg font-bold text-on-surface">Nova apresentação</h2>
            <input
              autoFocus
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título"
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
            <p className="text-xs text-on-surface-variant">Começa com Capa, Agenda e Encerramento.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNewTitle(null)} className="py-2 px-4 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high">Cancelar</button>
              <button type="submit" disabled={creating || newTitle.trim() === ""} className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                {creating ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {purging && (
        <PurgeDialog
          title={purging.title}
          onCancel={() => setPurging(null)}
          onConfirm={() => {
            const target = purging;
            setPurging(null);
            void run(() => purgePresentation({ variables: { id: target.id } }), "Erro ao excluir");
          }}
        />
      )}
    </div>
  );
}
