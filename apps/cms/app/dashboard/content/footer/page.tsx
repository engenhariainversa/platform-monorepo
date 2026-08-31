"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@repo/graphql/react";
import {
  GET_FOOTER_SECTION,
  UPSERT_FOOTER_SECTION,
  GET_SOCIAL_LINKS,
  CREATE_SOCIAL_LINK,
  UPDATE_SOCIAL_LINK,
  DELETE_SOCIAL_LINK,
  REORDER_SOCIAL_LINKS,
} from "@repo/graphql";
import type { FooterSection, SocialLink } from "@repo/types";

// Mirrors the column defaults: with no row saved yet the newsletter widget is
// hidden and the social block is shown.
const defaultFooter = { newsletterEnabled: false, socialLinksEnabled: true };

// Only absolute http(s) URLs are accepted: the value becomes the href of a
// footer link, so a relative path would resolve against the landing itself and
// a javascript:/data: value would be unsafe.
function isValidLinkUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// The cached `socialLinks` root field keeps the order it was first received in,
// and a reorder only rewrites each link's `order`. Sorting on ingest is what
// makes a new sequence stick without a refetch.
function sortByOrder(links: SocialLink[]) {
  return [...links].sort((a, b) => a.order - b.order);
}

export default function FooterContentPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/content"
          className="text-on-surface-variant hover:text-on-surface transition-colors"
        >
          ← Conteúdo
        </Link>
        <span className="text-outline-variant">/</span>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Footer
        </h1>
      </div>

      <VisibilitySection />
      <SocialLinksSection />
    </div>
  );
}

// The two visibility switches of the footer, saved together with an explicit
// button (unlike the link rows below, which save on blur).
function VisibilitySection() {
  const [newsletterEnabled, setNewsletterEnabled] = useState(
    defaultFooter.newsletterEnabled,
  );
  const [socialLinksEnabled, setSocialLinksEnabled] = useState(
    defaultFooter.socialLinksEnabled,
  );
  const [saved, setSaved] = useState(false);

  const { data, loading } = useQuery<{ footerSection: FooterSection | null }>(
    GET_FOOTER_SECTION,
  );

  useEffect(() => {
    if (data?.footerSection) {
      setNewsletterEnabled(data.footerSection.newsletterEnabled);
      setSocialLinksEnabled(data.footerSection.socialLinksEnabled);
    }
  }, [data]);

  const [upsertFooter, { loading: saving }] = useMutation<{
    upsertFooterSection: FooterSection;
  }>(UPSERT_FOOTER_SECTION);

  const handleSave = async () => {
    try {
      const { data: result } = await upsertFooter({
        variables: { input: { newsletterEnabled, socialLinksEnabled } },
      });
      if (result?.upsertFooterSection) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-outline-variant pb-3">
        <div>
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Exibição
          </h2>
          <p className="text-on-surface-variant text-sm">
            Escolha quais blocos do rodapé aparecem na landing page.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-primary">Salvo!</span>}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl border border-outline-variant p-5 space-y-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={newsletterEnabled}
            onChange={(e) => setNewsletterEnabled(e.target.checked)}
            disabled={loading}
            className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
          />
          <span>
            <span className="block text-sm text-on-surface font-label">
              Exibir o widget de newsletter
            </span>
            <span className="block text-xs text-on-surface-variant mt-0.5">
              O campo de e-mail ainda não tem cadastro por trás. Mantenha
              desligado até o fluxo de captura existir, para o rodapé não
              prometer algo que o produto não entrega.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={socialLinksEnabled}
            onChange={(e) => setSocialLinksEnabled(e.target.checked)}
            disabled={loading}
            className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
          />
          <span>
            <span className="block text-sm text-on-surface font-label">
              Exibir o bloco de links sociais
            </span>
            <span className="block text-xs text-on-surface-variant mt-0.5">
              Desligado, o bloco inteiro some do rodapé sem que você precise
              remover os links cadastrados abaixo.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}

function SocialLinksSection() {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [urlErrors, setUrlErrors] = useState<Record<string, string | undefined>>(
    {},
  );

  const { data, loading, refetch } = useQuery<{ socialLinks: SocialLink[] }>(
    GET_SOCIAL_LINKS,
  );

  useEffect(() => {
    if (data?.socialLinks) setLinks(sortByOrder(data.socialLinks));
  }, [data]);

  // Adding and removing has to rewrite the cached `socialLinks` list, not just
  // the local one: that cached list is what the query watcher broadcasts back
  // here, and a reorder makes it broadcast. Without these updates the broadcast
  // would replace local state with a list that never learned about the row just
  // added — so it would vanish until a refresh.
  const [createSocialLink] = useMutation<{ createSocialLink: SocialLink }>(
    CREATE_SOCIAL_LINK,
    {
      update(cache, { data: result }) {
        const created = result?.createSocialLink;
        if (!created) return;
        cache.updateQuery<{ socialLinks: SocialLink[] }>(
          { query: GET_SOCIAL_LINKS },
          (prev) =>
            prev ? { socialLinks: [...prev.socialLinks, created] } : undefined,
        );
      },
    },
  );
  const [updateSocialLink] = useMutation<{ updateSocialLink: SocialLink }>(
    UPDATE_SOCIAL_LINK,
  );
  const [deleteSocialLink] = useMutation(DELETE_SOCIAL_LINK, {
    update(cache, _result, { variables }) {
      const removedId = variables?.id;
      if (!removedId) return;
      cache.updateQuery<{ socialLinks: SocialLink[] }>(
        { query: GET_SOCIAL_LINKS },
        (prev) =>
          prev
            ? { socialLinks: prev.socialLinks.filter((l) => l.id !== removedId) }
            : undefined,
      );
    },
  });
  const [reorderSocialLinks] = useMutation(REORDER_SOCIAL_LINKS);

  const handleCreate = async () => {
    try {
      const { data: result } = await createSocialLink({
        variables: { input: { label: "Novo link", url: "https://" } },
      });
      if (!result?.createSocialLink) return;
    } catch (err) {
      console.error("Failed to create", err);
    }
  };

  const handleUpdate = async (id: string, field: string, value: string) => {
    setSaving(id);
    try {
      await updateSocialLink({ variables: { id, input: { [field]: value } } });
    } catch (err) {
      console.error("Failed to update", err);
    } finally {
      setSaving(null);
    }
  };

  // Validated on blur rather than on every keystroke: a half-typed URL is not
  // an error yet. An invalid value stays in the input but is never saved.
  const handleUrlBlur = async (id: string, rawValue: string) => {
    const value = rawValue.trim();

    if (!isValidLinkUrl(value)) {
      setUrlErrors((prev) => ({
        ...prev,
        [id]: "URL inválida. Use um endereço completo, começando com https://",
      }));
      return;
    }

    setUrlErrors((prev) => ({ ...prev, [id]: undefined }));
    await handleUpdate(id, "url", value);
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Remover "${label}"?`)) return;
    try {
      await deleteSocialLink({ variables: { id } });
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= links.length) return;
    const swapped = [...links];
    [swapped[index], swapped[newIndex]] = [swapped[newIndex], swapped[index]];
    // Renumber locally too, matching what the backend is about to persist: the
    // broadcast that follows is re-sorted by `order`.
    const newOrder = swapped.map((link, position) => ({
      ...link,
      order: position,
    }));
    setLinks(newOrder);
    try {
      await reorderSocialLinks({
        variables: { ids: newOrder.map((link) => link.id) },
      });
    } catch (err) {
      console.error("Failed to reorder", err);
      refetch();
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-outline-variant pb-3">
        <div>
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Links sociais
          </h2>
          <p className="text-on-surface-variant text-sm">
            {links.length} {links.length === 1 ? "link" : "links"} no bloco
            &quot;Social&quot; do rodapé.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90"
        >
          + Adicionar link
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link, index) => (
            <div
              key={link.id}
              className="bg-surface-container rounded-xl border border-outline-variant p-4 flex items-start gap-4"
            >
              <div className="flex flex-col gap-1 pt-2">
                <button
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  aria-label="Mover para cima"
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 text-xs"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMove(index, 1)}
                  disabled={index === links.length - 1}
                  aria-label="Mover para baixo"
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 text-xs"
                >
                  ▼
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-on-surface-variant mb-1 font-label">
                    Rótulo
                  </label>
                  <input
                    type="text"
                    defaultValue={link.label}
                    onBlur={(e) =>
                      handleUpdate(link.id, "label", e.target.value)
                    }
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-on-surface-variant mb-1 font-label">
                    URL de destino
                  </label>
                  <input
                    type="url"
                    defaultValue={link.url}
                    onBlur={(e) => handleUrlBlur(link.id, e.target.value)}
                    placeholder="https://..."
                    className={`w-full bg-surface-container-high border rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:outline-none text-sm font-code ${
                      urlErrors[link.id]
                        ? "border-error focus:ring-error"
                        : "border-outline-variant focus:ring-primary"
                    }`}
                  />
                  {urlErrors[link.id] && (
                    <p className="text-xs text-error mt-1">
                      {urlErrors[link.id]}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 pt-6">
                {saving === link.id && (
                  <span className="text-xs text-primary">Salvando...</span>
                )}
                <button
                  onClick={() => handleDelete(link.id, link.label)}
                  className="text-xs text-error hover:bg-error/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}

          {links.length === 0 && (
            <div className="bg-surface-container rounded-xl border border-outline-variant p-12 text-center">
              <span className="text-4xl mb-4 block">🔗</span>
              <p className="text-on-surface-variant">
                Nenhum link cadastrado. O bloco &quot;Social&quot; não é
                exibido na landing enquanto a lista estiver vazia.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
