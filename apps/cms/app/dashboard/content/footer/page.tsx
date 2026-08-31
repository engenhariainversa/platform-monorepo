"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@repo/graphql/react";
import { GET_FOOTER_SECTION, UPSERT_FOOTER_SECTION } from "@repo/graphql";
import type { FooterSection } from "@repo/types";

// Mirrors the column default: with no row saved yet the widget is hidden.
const defaultFooter = { newsletterEnabled: false };

export default function FooterContentPage() {
  const [newsletterEnabled, setNewsletterEnabled] = useState(
    defaultFooter.newsletterEnabled,
  );
  const [saved, setSaved] = useState(false);

  const { data, loading } = useQuery<{ footerSection: FooterSection | null }>(
    GET_FOOTER_SECTION,
  );

  useEffect(() => {
    if (data?.footerSection) {
      setNewsletterEnabled(data.footerSection.newsletterEnabled);
    }
  }, [data]);

  const [upsertFooter, { loading: saving }] = useMutation<{
    upsertFooterSection: FooterSection;
  }>(UPSERT_FOOTER_SECTION);

  const handleSave = async () => {
    try {
      const { data: result } = await upsertFooter({
        variables: { input: { newsletterEnabled } },
      });
      if (result?.upsertFooterSection) {
        setNewsletterEnabled(result.upsertFooterSection.newsletterEnabled);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save", err);
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
            Footer
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

      {/* Newsletter */}
      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-5">
        <div>
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Newsletter
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Bloco &quot;Assine a News&quot; exibido no footer da landing page.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={newsletterEnabled}
            onChange={(e) => setNewsletterEnabled(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
          />
          <span>
            <span className="block text-sm text-on-surface font-label">
              Exibir o widget de newsletter
            </span>
            <span className="block text-xs text-on-surface-variant mt-0.5">
              O campo de e-mail ainda não tem cadastro por trás. Mantenha
              desligado até o fluxo de captura existir, para o footer não
              prometer algo que o produto não entrega.
            </span>
          </span>
        </label>

        <p className="text-xs text-on-surface-variant border-t border-outline-variant pt-4">
          {newsletterEnabled
            ? "O bloco está sendo exibido na landing."
            : "O bloco não é renderizado na landing."}
        </p>
      </div>
    </div>
  );
}
