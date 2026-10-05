"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useApolloClient, useMutation, useQuery } from "@repo/graphql/react";
import {
  CREATE_SLIDE,
  DELETE_SLIDE,
  GET_PRESENTATION,
  REORDER_SLIDES,
  UPDATE_PRESENTATION,
  UPDATE_SLIDE,
  getUploadUrl,
  graphQLErrorCode,
  graphQLErrorMessage,
} from "@repo/graphql";
import type { Presentation, PresentationVisibility } from "@repo/types";
import {
  SLIDE_TEMPLATE_KEYS,
  SLIDE_TEMPLATES,
  isSlideTemplateKey,
  parseSlideContent,
  switchTemplate,
  type SlideTemplateKey,
} from "@repo/slides";
import { SlideRenderer } from "@repo/ui";
import { PresentationHeader } from "../../../../components/presentations/presentation-header";
import { SlideList } from "../../../../components/presentations/slide-list";
import { TemplateGallery } from "../../../../components/presentations/template-gallery";
import { SlideForm } from "../../../../components/presentations/slide-form";
import { inputClass } from "../../../../components/presentations/field-input";
import { issuesByPath } from "../../../../components/presentations/form-state";
import { mergeDrafts, moveId, toDraft, type SlideDraft } from "../../../../components/presentations/editor-drafts";
import {
  SaveTracker,
  laterTimestamp,
  shouldApplySync,
  shouldShowBanner,
  type SaveStatus,
} from "../../../../components/presentations/editor-sync";

const AUTOSAVE_MS = 800;

type PresentationData = { presentation: Presentation | null };

export default function PresentationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const client = useApolloClient();
  // network-only: the editor never starts from a stale cached copy.
  const { data, loading } = useQuery<PresentationData>(GET_PRESENTATION, {
    variables: { id },
    fetchPolicy: "network-only",
  });
  const [updatePresentation] = useMutation(UPDATE_PRESENTATION);
  const [updateSlide] = useMutation(UPDATE_SLIDE);
  const [createSlide] = useMutation<{ createSlide: { id: string } }>(CREATE_SLIDE);
  const [deleteSlide] = useMutation(DELETE_SLIDE);
  const [reorderSlides] = useMutation(REORDER_SLIDES);

  /** The last server state this tab applied (after the first load). */
  const [server, setServer] = useState<Presentation | null>(null);
  const presentation = server ?? data?.presentation ?? null;
  const [drafts, setDrafts] = useState<SlideDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [metaError, setMetaError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [externalChange, setExternalChange] = useState(false);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const tracker = useRef(new SaveTracker());
  const knownUpdatedAt = useRef<string | null>(null);
  const initialised = useRef(false);
  const structuralError = useRef(false);
  /** Writes (mutation + its sync) currently running in this tab. */
  const writesInFlight = useRef(0);
  /** Incremented whenever a write starts; lets a refetch know a write began after it was requested. */
  const writeEpoch = useRef(0);
  const syncSeq = useRef(0);
  const appliedSync = useRef(0);

  const refreshStatus = useCallback(() => {
    setStatus(tracker.current.status(writesInFlight.current, structuralError.current));
  }, []);

  // First load: take the server state as-is.
  useEffect(() => {
    const loaded = data?.presentation;
    if (!loaded || initialised.current) return;
    initialised.current = true;
    knownUpdatedAt.current = loaded.updatedAt;
    const initial = [...loaded.slides].sort((a, b) => a.order - b.order).map(toDraft);
    setDrafts(initial);
    setSelectedId(initial[0]?.id ?? null);
  }, [data]);

  // Pending autosaves die with the page.
  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
    };
  }, []);

  /**
   * Fresh copy straight from the network: no cache (out-of-order responses
   * cannot overwrite each other there) and no deduplication with an identical
   * request that left before our write.
   */
  const fetchFresh = useCallback(async () => {
    const { data: result } = await client.query<PresentationData>({
      query: GET_PRESENTATION,
      variables: { id },
      fetchPolicy: "no-cache",
      context: { queryDeduplication: false },
    });
    return result?.presentation ?? null;
  }, [client, id]);

  /** Refetch after one of our own writes and adopt the result as "known". */
  const syncAfterOwnWrite = useCallback(async () => {
    const seq = ++syncSeq.current;
    const epochAtStart = writeEpoch.current;
    try {
      const fresh = await fetchFresh();
      if (!fresh) return;
      if (!shouldApplySync({ seq, lastApplied: appliedSync.current, epochAtStart, epochNow: writeEpoch.current })) return;
      appliedSync.current = seq;
      knownUpdatedAt.current = laterTimestamp(knownUpdatedAt.current, fresh.updatedAt);
      setServer(fresh);
      setDrafts((local) => mergeDrafts(fresh.slides, local, tracker.current.pending));
    } catch (err) {
      console.error("Failed to refresh the presentation", err);
    }
  }, [fetchFresh]);

  /** Runs one write of this tab followed by its sync, keeping the in-flight bookkeeping. */
  const runWrite = useCallback(
    async (action: () => Promise<void>) => {
      writesInFlight.current++;
      writeEpoch.current++;
      refreshStatus();
      try {
        await action();
      } finally {
        await syncAfterOwnWrite();
        writesInFlight.current--;
        refreshStatus();
      }
    },
    [refreshStatus, syncAfterOwnWrite],
  );

  // Writes from outside this tab (the API, another tab) show a banner instead
  // of replacing what is on screen.
  useEffect(() => {
    const onFocus = async () => {
      const writesInFlightAtStart = writesInFlight.current;
      const epochAtStart = writeEpoch.current;
      try {
        const fresh = await fetchFresh();
        if (
          fresh &&
          shouldShowBanner({
            fresh: fresh.updatedAt,
            known: knownUpdatedAt.current,
            writesInFlightAtStart,
            writesInFlightNow: writesInFlight.current,
            epochAtStart,
            epochNow: writeEpoch.current,
          })
        ) {
          setExternalChange(true);
        }
      } catch (err) {
        console.error("Failed to check the presentation for changes", err);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchFresh]);

  const reloadFromServer = async () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    tracker.current.clear();
    structuralError.current = false;
    const seq = ++syncSeq.current;
    try {
      const fresh = await fetchFresh();
      if (!fresh || seq <= appliedSync.current) return;
      appliedSync.current = seq;
      knownUpdatedAt.current = laterTimestamp(knownUpdatedAt.current, fresh.updatedAt);
      setServer(fresh);
      const next = [...fresh.slides].sort((a, b) => a.order - b.order).map(toDraft);
      setDrafts(next);
      setSelectedId((current) => (next.some((d) => d.id === current) ? current : next[0]?.id ?? null));
      setExternalChange(false);
    } catch (err) {
      console.error("Failed to reload the presentation", err);
      alert(graphQLErrorMessage(err));
    } finally {
      refreshStatus();
    }
  };

  const scheduleSave = (draft: SlideDraft) => {
    const existing = timers.current.get(draft.id);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(draft.id);
    }
    const valid = parseSlideContent(draft.template, draft.content).ok;
    const seq = tracker.current.edit(draft.id, valid);
    refreshStatus();
    if (!valid) return; // invalid content is never sent
    timers.current.set(
      draft.id,
      setTimeout(() => {
        timers.current.delete(draft.id);
        void runWrite(async () => {
          try {
            await updateSlide({
              variables: { id: draft.id, input: { template: draft.template, content: draft.content, notes: draft.notes } },
            });
            tracker.current.saved(draft.id, seq);
          } catch (err) {
            console.error("Failed to save slide", err);
            tracker.current.failedSave(draft.id, seq);
          }
        });
      }, AUTOSAVE_MS),
    );
  };

  const editDraft = (id: string, change: Partial<SlideDraft>) => {
    const current = drafts.find((d) => d.id === id);
    if (!current) return;
    const next = { ...current, ...change };
    setDrafts((list) => list.map((d) => (d.id === id ? next : d)));
    scheduleSave(next);
  };

  const runStructural = (action: () => Promise<unknown>) =>
    runWrite(async () => {
      try {
        await action();
        structuralError.current = false;
      } catch (err) {
        console.error(err);
        structuralError.current = true;
        alert(graphQLErrorMessage(err));
      }
    });

  const handleMove = (from: number, to: number) => {
    if (to < 0 || to >= drafts.length || from === to) return;
    const ids = moveId(drafts.map((d) => d.id), from, to);
    setDrafts((current) => ids.map((slideId) => current.find((d) => d.id === slideId)!));
    void runStructural(() => reorderSlides({ variables: { presentationId: id, ids } }));
  };

  const handleAdd = async (template: SlideTemplateKey) => {
    setGalleryOpen(false);
    const selectedIndex = drafts.findIndex((d) => d.id === selectedId);
    await runStructural(async () => {
      const { data: created } = await createSlide({
        variables: {
          presentationId: id,
          input: { template, content: SLIDE_TEMPLATES[template].defaults },
          position: selectedIndex + 1,
        },
      });
      if (created?.createSlide) setSelectedId(created.createSlide.id);
    });
  };

  const handleDuplicate = (index: number) => {
    const source = drafts[index];
    void runStructural(async () => {
      const { data: created } = await createSlide({
        variables: {
          presentationId: id,
          input: { template: source.template, content: source.content, notes: source.notes, hidden: source.hidden },
          position: index + 1,
        },
      });
      if (created?.createSlide) setSelectedId(created.createSlide.id);
    });
  };

  const handleToggleHidden = (index: number) => {
    const slide = drafts[index];
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, hidden: !d.hidden } : d)));
    void runStructural(() => updateSlide({ variables: { id: slide.id, input: { hidden: !slide.hidden } } }));
  };

  const handleDelete = (index: number) => {
    const slide = drafts[index];
    if (!confirm(`Excluir o slide ${index + 1}?`)) return;
    // Drop its unsent autosave: it would hit a slide that no longer exists.
    const timer = timers.current.get(slide.id);
    if (timer) clearTimeout(timer);
    timers.current.delete(slide.id);
    tracker.current.forget(slide.id);
    const fallback = drafts[index + 1] ?? drafts[index - 1];
    setSelectedId(fallback?.id ?? null);
    void runStructural(() => deleteSlide({ variables: { id: slide.id } }));
  };

  const handleMeta = (input: { title?: string; slug?: string; visibility?: PresentationVisibility }) => {
    setMetaError("");
    void runWrite(async () => {
      try {
        await updatePresentation({ variables: { id, input } });
      } catch (err) {
        const code = graphQLErrorCode(err);
        setMetaError(
          code === "SLUG_TAKEN" ? "Este slug já está em uso."
          : code === "INVALID_SLUG" ? "Slug inválido."
          : graphQLErrorMessage(err),
        );
      }
    });
  };

  const selected = drafts.find((d) => d.id === selectedId) ?? null;
  const selectedIndex = drafts.findIndex((d) => d.id === selectedId);
  const issues = useMemo(() => {
    if (!selected) return {};
    const parsed = parseSlideContent(selected.template, selected.content);
    return parsed.ok ? {} : issuesByPath(parsed.issues);
  }, [selected]);

  if (loading && !presentation) {
    return <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />;
  }
  if (!presentation) {
    return <p className="text-on-surface-variant">Apresentação não encontrada.</p>;
  }

  return (
    <div className="space-y-4">
      {externalChange && (
        <div className="flex items-center justify-between rounded-lg border border-secondary bg-secondary/10 px-4 py-2 text-sm text-secondary">
          Esta apresentação foi alterada pela API — recarregar
          <button onClick={() => void reloadFromServer()} className="font-bold underline">Recarregar</button>
        </div>
      )}

      <PresentationHeader presentation={presentation} status={status} metaError={metaError} onSave={handleMeta} />

      <div className="grid grid-cols-[200px_1fr_380px] gap-6 h-[calc(100vh-15rem)]">
        <SlideList
          slides={drafts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={handleMove}
          onDuplicate={handleDuplicate}
          onToggleHidden={handleToggleHidden}
          onDelete={handleDelete}
          onAdd={() => setGalleryOpen(true)}
        />

        <div className="min-w-0">
          {selected ? (
            <SlideRenderer
              template={selected.template}
              content={selected.content}
              slideNumber={selectedIndex + 1}
              context={{ resolveUrl: (u) => getUploadUrl(u) }}
            />
          ) : (
            <p className="text-on-surface-variant text-sm">Nenhum slide selecionado.</p>
          )}
        </div>

        <div className="overflow-y-auto space-y-6 pr-1">
          {selected && isSlideTemplateKey(selected.template) && (
            <>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 font-label">Modelo</label>
                <select
                  className={inputClass}
                  value={selected.template}
                  onChange={(e) => {
                    const to = e.target.value as SlideTemplateKey;
                    editDraft(selected.id, { template: to, content: switchTemplate(selected.content, to) });
                  }}
                >
                  {SLIDE_TEMPLATE_KEYS.map((key) => (
                    <option key={key} value={key}>{SLIDE_TEMPLATES[key].label}</option>
                  ))}
                </select>
              </div>
              <SlideForm
                template={selected.template}
                value={selected.content}
                issues={issues}
                onChange={(content) => editDraft(selected.id, { content })}
              />
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 font-label">Anotações do apresentador</label>
                <textarea
                  rows={6}
                  className={inputClass}
                  value={selected.notes}
                  onChange={(e) => editDraft(selected.id, { notes: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {galleryOpen && <TemplateGallery onPick={(key) => void handleAdd(key)} onClose={() => setGalleryOpen(false)} />}
    </div>
  );
}
