"use client";

import Link from "next/link";

export default function ContentPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Conteúdo
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Gerencie o conteúdo exibido na landing page
        </p>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hero Section Card */}
        <Link
          href="/dashboard/content/hero"
          className="group bg-surface-container rounded-xl p-6 border border-outline-variant hover:border-primary transition-colors"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <span className="text-2xl">✨</span>
            </div>
            <span className="text-xs font-code text-on-surface-variant bg-surface-container-high px-2 py-1 rounded">
              seção principal
            </span>
          </div>
          <h2 className="font-headline text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
            Hero Section
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Edite o título, subtítulo e o botão da seção principal no topo da
            landing page.
          </p>
        </Link>

        {/* Live Card */}
        <Link
          href="/dashboard/content/live"
          className="group bg-surface-container rounded-xl p-6 border border-outline-variant hover:border-primary transition-colors"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-error/15 flex items-center justify-center">
              <span className="text-2xl">🔴</span>
            </div>
            <span className="text-xs font-code text-on-surface-variant bg-surface-container-high px-2 py-1 rounded">
              1 ativa
            </span>
          </div>
          <h2 className="font-headline text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
            Live
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Gerencie a live em destaque na landing page. Apenas uma live por
            vez.
          </p>
        </Link>

        {/* Episodes Card */}
        <Link
          href="/dashboard/content/episodes"
          className="group bg-surface-container rounded-xl p-6 border border-outline-variant hover:border-primary transition-colors"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/15 flex items-center justify-center">
              <span className="text-2xl">🎬</span>
            </div>
            <span className="text-xs font-code text-on-surface-variant bg-surface-container-high px-2 py-1 rounded">
              máx. 4 itens
            </span>
          </div>
          <h2 className="font-headline text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
            Episódios Recentes
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Gerencie os 4 episódios exibidos na seção de episódios recentes.
          </p>
        </Link>
      </div>
    </div>
  );
}
