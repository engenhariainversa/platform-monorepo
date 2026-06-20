"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { graphqlRequest, setAuthCookie } from "../../lib/graphql-client";
import { SETUP_ADMIN } from "../../lib/queries";

const steps = [
  { title: "Bem-vindo", description: "Configure seu primeiro administrador" },
  { title: "Criar Admin", description: "Preencha os dados do administrador" },
  { title: "Pronto!", description: "Tudo configurado com sucesso" },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async () => {
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (form.password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const data = await graphqlRequest<{
        setupAdmin: { token: string; user: { firstName: string } };
      }>(SETUP_ADMIN, {
        input: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          username: form.username,
          password: form.password,
        },
      });

      setAuthCookie(data.setupAdmin.token);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {steps.map((s, i) => (
            <div key={s.title} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  i <= step
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 ${
                    i < step ? "bg-primary" : "bg-outline-variant"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-8">
            <div className="w-24 h-24 mx-auto bg-surface-container-high rounded-2xl flex items-center justify-center">
              <span className="text-5xl">🤖</span>
            </div>
            <div className="space-y-3">
              <h1 className="font-headline text-3xl font-bold text-on-surface">
                Bem-vindo ao CMS
              </h1>
              <p className="text-on-surface-variant font-body max-w-md mx-auto">
                Parece que é a primeira vez que você acessa o painel. Vamos
                configurar o primeiro administrador do sistema.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="bg-primary text-on-primary font-bold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity"
            >
              Começar configuração
            </button>
          </div>
        )}

        {/* Step 1: Form */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="font-headline text-2xl font-bold text-on-surface">
                Criar Administrador
              </h1>
              <p className="text-on-surface-variant text-sm">
                Este será o super admin com acesso total ao sistema.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-on-surface-variant mb-1 font-label">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="Pedro"
                  />
                </div>
                <div>
                  <label className="block text-sm text-on-surface-variant mb-1 font-label">
                    Sobrenome
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="Silva"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="admin@engenhariainversa.com"
                />
              </div>

              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Username
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="admin"
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
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm text-on-surface-variant mb-1 font-label">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({ ...form, confirmPassword: e.target.value })
                  }
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Repita a senha"
                />
              </div>

              {error && (
                <p className="text-error text-sm bg-error-container/20 px-4 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 border border-outline-variant text-on-surface-variant py-3 rounded-lg hover:bg-surface-container transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    loading ||
                    !form.firstName ||
                    !form.lastName ||
                    !form.email ||
                    !form.username ||
                    !form.password
                  }
                  className="flex-1 bg-primary text-on-primary font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Criando..." : "Criar Admin"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Success */}
        {step === 2 && (
          <div className="text-center space-y-8">
            <div className="w-24 h-24 mx-auto bg-primary/20 rounded-2xl flex items-center justify-center">
              <span className="text-5xl">🎉</span>
            </div>
            <div className="space-y-3">
              <h1 className="font-headline text-3xl font-bold text-on-surface">
                Tudo pronto!
              </h1>
              <p className="text-on-surface-variant font-body max-w-md mx-auto">
                O administrador foi criado com sucesso. Você já está
                autenticado e pode acessar o painel.
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-primary text-on-primary font-bold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity"
            >
              Acessar Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
