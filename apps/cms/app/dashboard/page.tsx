"use client";

import Link from "next/link";
import { useQuery } from "@repo/graphql/react";
import { GET_DASHBOARD_STATS } from "@repo/graphql";
import type { DashboardStats } from "@repo/types";

// Each card doubles as a shortcut to the screen that manages the collection it
// counts. There is no "Páginas" card: nothing feeds that counter today.
const statCards = [
  {
    key: "users" as const,
    label: "Usuários",
    icon: "👥",
    href: "/dashboard/users",
  },
  {
    key: "episodes" as const,
    label: "Episódios",
    icon: "🎬",
    href: "/dashboard/content/episodes",
  },
  {
    key: "lives" as const,
    label: "Lives",
    icon: "🔴",
    href: "/dashboard/content/live",
  },
];

const quickActions = [
  {
    label: "+ Novo Usuário",
    href: "/dashboard/users?new=1",
    className: "bg-primary/15 text-primary hover:bg-primary/25",
  },
  {
    label: "+ Novo Episódio",
    href: "/dashboard/content/episodes",
    className: "bg-tertiary/15 text-tertiary hover:bg-tertiary/25",
  },
];

export default function DashboardPage() {
  const { data, loading } = useQuery<{ dashboardStats: DashboardStats }>(
    GET_DASHBOARD_STATS,
  );
  const stats = data?.dashboardStats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Dashboard
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Visão geral do sistema
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="group bg-surface-container rounded-xl p-5 border border-outline-variant hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <p className="font-headline text-2xl font-bold text-on-surface">
              {loading || !stats ? "—" : stats[card.key]}
            </p>
            <p className="text-on-surface-variant text-sm group-hover:text-primary transition-colors">
              {card.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant">
        <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
          Ações Rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${action.className}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
