"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@repo/graphql/react";
import { LOGIN, setAuthToken } from "@repo/graphql";
import type { AuthPayload } from "@repo/types";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });
  const [login, { loading }] = useMutation<{ login: AuthPayload }>(LOGIN);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const { data } = await login({
        variables: {
          input: {
            identifier: form.identifier,
            password: form.password,
          },
        },
      });

      if (data?.login) {
        setAuthToken(data.login.token);
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Credenciais inválidas",
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center space-y-4 mb-8">
          <div className="w-16 h-16 mx-auto bg-surface-container-high rounded-2xl flex items-center justify-center">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Entrar no CMS
          </h1>
          <p className="text-on-surface-variant text-sm">
            Use seu email ou username para acessar o painel.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-on-surface-variant mb-1 font-label">
              Email ou Username
            </label>
            <input
              type="text"
              value={form.identifier}
              onChange={(e) =>
                setForm({ ...form, identifier: e.target.value })
              }
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="admin@engenhariainversa.com"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1 font-label">
              Senha
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-error text-sm bg-error-container/20 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !form.identifier || !form.password}
            className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
