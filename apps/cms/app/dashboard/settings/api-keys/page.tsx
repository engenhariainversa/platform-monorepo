"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@repo/graphql/react";
import { CREATE_API_KEY, GET_API_KEYS, REVOKE_API_KEY } from "@repo/graphql";
import type { ApiKey } from "@repo/types";
import { relativeTime } from "../../../../lib/relative-time";
import { API_KEY_STATUS_LABEL, apiKeyStatus } from "../../../../lib/api-key-status";

const EXPIRY_OPTIONS = [
  { value: "ONE_HOUR", label: "1 hora" },
  { value: "ONE_DAY", label: "24 horas" },
  { value: "SEVEN_DAYS", label: "7 dias" },
] as const;

const STATUS_CLASS = {
  active: "bg-primary/15 text-primary",
  expired: "bg-surface-container-high text-on-surface-variant",
  revoked: "bg-error-container/30 text-error",
} as const;

const inputClass =
  "w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm";

export default function ApiKeysPage() {
  const { data, loading } = useQuery<{ apiKeys: ApiKey[] }>(GET_API_KEYS, {
    fetchPolicy: "cache-and-network",
  });
  const [revokeApiKey] = useMutation(REVOKE_API_KEY, { refetchQueries: [GET_API_KEYS] });
  const [creating, setCreating] = useState(false);

  const keys = data?.apiKeys ?? [];

  const handleRevoke = async (key: ApiKey) => {
    if (!confirm(`Revogar a chave "${key.name}"? Quem estiver usando perde o acesso na próxima requisição.`)) return;
    try {
      await revokeApiKey({ variables: { id: key.id } });
    } catch (err) {
      console.error("Failed to revoke", err);
      alert("Não foi possível revogar a chave.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="text-on-surface-variant hover:text-on-surface transition-colors">
            ← Configurações
          </Link>
          <span className="text-outline-variant">/</span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Chaves de API</h1>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90"
        >
          Gerar chave
        </button>
      </div>

      <p className="text-on-surface-variant text-sm max-w-2xl">
        Chaves temporárias para criar e editar apresentações pela API (por exemplo, pelo
        Claude). Cada chave age em seu nome, expira sozinha e pode ser revogada a qualquer
        momento.
      </p>

      {loading && keys.length === 0 ? (
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      ) : keys.length === 0 ? (
        <p className="text-on-surface-variant text-sm">Nenhuma chave gerada ainda.</p>
      ) : (
        <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-high text-on-surface-variant text-left">
              <tr>
                <th className="px-4 py-3 font-label">Nome</th>
                <th className="px-4 py-3 font-label">Chave</th>
                <th className="px-4 py-3 font-label">Criada</th>
                <th className="px-4 py-3 font-label">Expira</th>
                <th className="px-4 py-3 font-label">Último uso</th>
                <th className="px-4 py-3 font-label">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const status = apiKeyStatus(key);
                return (
                  <tr key={key.id} className="border-t border-outline-variant">
                    <td className="px-4 py-3 text-on-surface">{key.name}</td>
                    <td className="px-4 py-3 font-code text-on-surface-variant">ei_{key.prefix}…</td>
                    <td className="px-4 py-3 text-on-surface-variant">{relativeTime(key.createdAt)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{relativeTime(key.expiresAt)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {key.lastUsedAt ? relativeTime(key.lastUsedAt) : "nunca"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${STATUS_CLASS[status]}`}>
                        {API_KEY_STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "active" && (
                        <button onClick={() => handleRevoke(key)} className="text-error hover:underline text-sm">
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateKeyModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateKeyModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [expiresIn, setExpiresIn] = useState<(typeof EXPIRY_OPTIONS)[number]["value"]>("ONE_DAY");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [createApiKey, { loading }] = useMutation<{ createApiKey: { apiKey: ApiKey; token: string } }>(
    CREATE_API_KEY,
    { refetchQueries: [GET_API_KEYS] },
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await createApiKey({ variables: { name: name.trim(), expiresIn } });
      if (data?.createApiKey) setToken(data.createApiKey.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a chave");
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg bg-surface-container rounded-xl border border-outline-variant p-6 space-y-5">
        {token ? (
          <>
            <h2 className="font-headline text-lg font-bold text-on-surface">Chave gerada</h2>
            <p className="text-sm text-secondary">
              Copie agora: esta chave não será exibida de novo.
            </p>
            <div className="flex gap-2">
              <input readOnly value={token} className={`${inputClass} font-code`} onFocus={(e) => e.currentTarget.select()} />
              <button onClick={handleCopy} className="bg-surface-container-high text-on-surface py-2 px-4 rounded-lg text-sm whitespace-nowrap">
                {copied ? "Copiada!" : "Copiar"}
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm">
                Concluir
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="font-headline text-lg font-bold text-on-surface">Gerar chave de API</h2>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">Nome</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Live #12 — Claude"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">Expira em</label>
              <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value as typeof expiresIn)} className={inputClass}>
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || name.trim() === ""}
                className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
              >
                {loading ? "Gerando..." : "Gerar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
