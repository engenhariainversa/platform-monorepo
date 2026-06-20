"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { graphqlRequest, removeAuthCookie } from "../../lib/graphql-client";
import { ME } from "../../lib/queries";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: {
    id: string;
    name: string;
    label: string;
    isAdmin: boolean;
  };
};

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: "📊", exact: true },
  { label: "Conteúdo", href: "/dashboard/content", icon: "🎬" },
  { label: "Usuários", href: "/dashboard/users", icon: "👥", roles: ["ADMIN", "MANAGER"] },
  { label: "Páginas", href: "/dashboard/pages", icon: "📄" },
  { label: "Configurações", href: "/dashboard/settings", icon: "⚙️", roles: ["ADMIN"] },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const data = await graphqlRequest<{ me: User }>(ME);
        setUser(data.me);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  const handleLogout = () => {
    removeAuthCookie();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const filteredMenu = menuItems.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role.name);
  });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-container-lowest border-r border-outline-variant flex flex-col">
        {/* Logo */}
        <div className="h-16 px-4 flex items-center gap-3 border-b border-outline-variant">
          <span className="text-2xl">🤖</span>
          <span className="font-headline font-bold text-primary text-sm">
            CMS
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {filteredMenu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                (item.exact ? pathname === item.href : pathname.startsWith(item.href))
                  ? "bg-primary/15 text-primary font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-outline-variant">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-on-surface-variant truncate">
                {user?.role?.label}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-sm text-on-surface-variant hover:text-error py-2 rounded-lg hover:bg-error-container/10 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
