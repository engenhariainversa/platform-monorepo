"use client";

import Link from "next/link";

const settingsItems = [
  {
    label: "Permissões",
    href: "/dashboard/settings/permissions",
    icon: "🛡️",
    description: "Configure quais ações cada role pode realizar",
  },
  {
    label: "Roles",
    href: "/dashboard/settings/roles",
    icon: "🏷️",
    description: "Gerencie os roles do sistema",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Configurações
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Gerencie as configurações do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-surface-container rounded-xl border border-outline-variant p-6 hover:border-primary/40 hover:bg-surface-container-high transition-all group"
          >
            <span className="text-3xl block mb-3">{item.icon}</span>
            <h2 className="font-headline text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
              {item.label}
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
