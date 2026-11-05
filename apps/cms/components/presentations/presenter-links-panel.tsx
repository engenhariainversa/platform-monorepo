"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@repo/graphql/react";
import { CREATE_PRESENTER_LINK, GET_PRESENTER_LINKS, REVOKE_PRESENTER_LINK } from "@repo/graphql";
import type { PresenterLink, PresenterLinkExpiry } from "@repo/types";
import { apiKeyStatus, type ApiKeyStatus } from "../../lib/api-key-status";
import { relativeTime } from "../../lib/relative-time";
import { inputClass } from "./field-input";

const EXPIRY_OPTIONS: { value: PresenterLinkExpiry; label: string }[] = [
  { value: "TWO_HOURS", label: "2 horas" },
  { value: "TWELVE_HOURS", label: "12 horas" },
  { value: "ONE_DAY", label: "24 horas" },
  { value: "SEVEN_DAYS", label: "7 dias" },
];

// A presenter link has the same expiry/revocation fields as an API key.
const STATUS_LABEL: Record<ApiKeyStatus, string> = { active: "Ativo", expired: "Expirado", revoked: "Revogado" };
const STATUS_CLASS: Record<ApiKeyStatus, string> = {
  active: "bg-secondary/20 text-secondary",
  expired: "bg-surface-container-high text-on-surface-variant",
  revoked: "bg-error/20 text-error",
};

/**
 * "Links de apresentador": temporary URLs that open this presentation, with its
 * notes and live controls, on a machine without a CMS session.
 */
export function PresenterLinksPanel({ presentationId }: { presentationId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm py-2 px-3 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
      >
        Links de apresentador
      </button>
      {open && <PresenterLinksModal presentationId={presentationId} onClose={() => setOpen(false)} />}
    </>
  );
}

function PresenterLinksModal({ presentationId, onClose }: { presentationId: string; onClose: () => void }) {
  const variables = { presentationId };
  const refetchQueries = [{ query: GET_PRESENTER_LINKS, variables }];
  const { data, loading } = useQuery<{ presenterLinks: PresenterLink[] }>(GET_PRESENTER_LINKS, {
    variables,
    fetchPolicy: "cache-and-network",
  });
  const [createLink, { loading: creating }] = useMutation<{
    createPresenterLink: { url: string; presenterLink: PresenterLink };
  }>(CREATE_PRESENTER_LINK, { refetchQueries });
  const [revokeLink] = useMutation(REVOKE_PRESENTER_LINK, { refetchQueries });

  const [name, setName] = useState("");
  const [expiresIn, setExpiresIn] = useState<PresenterLinkExpiry>("TWO_HOURS");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const links = data?.presenterLinks ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await createLink({ variables: { presentationId, name: name.trim(), expiresIn } });
      if (result.data?.createPresenterLink) {
        setUrl(result.data.createPresenterLink.url);
        setCopied(false);
        setName("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar o link");
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  const handleRevoke = async (link: PresenterLink) => {
    if (!confirm(`Revogar o link "${link.name}"? Quem estiver usando é desconectado na hora.`)) return;
    try {
      await revokeLink({ variables: { id: link.id } });
    } catch (err) {
      console.error("Failed to revoke", err);
      alert("Não foi possível revogar o link.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl space-y-5 rounded-xl border border-outline-variant bg-surface-container p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">Links de apresentador</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Abre esta apresentação — com anotações e controles ao vivo — em outro computador, sem login.
              O link não permite editar nada.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            Fechar
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block font-label text-xs text-on-surface-variant">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Notebook do evento"
              maxLength={80}
              required
              className={inputClass}
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block font-label text-xs text-on-surface-variant">Expira em</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value as PresenterLinkExpiry)}
              className={inputClass}
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
          >
            Gerar link
          </button>
        </form>
        {error && <p className="text-sm text-error">{error}</p>}

        {url && (
          <div className="space-y-2 rounded-lg border border-secondary/40 bg-surface-container-high p-4">
            <p className="text-sm font-bold text-on-surface">Copie agora: este link não será mostrado de novo.</p>
            <div className="flex gap-2">
              <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${inputClass} font-code text-xs`} />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-on-secondary"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        {loading && links.length === 0 ? (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        ) : links.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhum link gerado para esta apresentação.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-on-surface-variant">
              <tr>
                <th className="py-2 font-label">Nome</th>
                <th className="py-2 font-label">Link</th>
                <th className="py-2 font-label">Expira</th>
                <th className="py-2 font-label">Último uso</th>
                <th className="py-2 font-label">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const status = apiKeyStatus(link);
                return (
                  <tr key={link.id} className="border-t border-outline-variant">
                    <td className="py-2 text-on-surface">{link.name}</td>
                    <td className="py-2 font-code text-on-surface-variant">eip_{link.prefix}…</td>
                    <td className="py-2 text-on-surface-variant">{relativeTime(link.expiresAt)}</td>
                    <td className="py-2 text-on-surface-variant">
                      {link.lastUsedAt ? relativeTime(link.lastUsedAt) : "nunca"}
                    </td>
                    <td className="py-2">
                      <span className={`rounded px-2 py-1 text-xs font-bold ${STATUS_CLASS[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {status === "active" && (
                        <button type="button" onClick={() => handleRevoke(link)} className="text-sm text-error hover:underline">
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
