"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@repo/graphql/react";
import { ME } from "@repo/graphql";
import type { User } from "@repo/types";

// Same login check as the dashboard layout, without the sidebar: these pages
// are the slides themselves.
export default function PresentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { error, loading } = useQuery<{ me: User }>(ME);

  useEffect(() => {
    if (error) router.replace("/login");
  }, [error, router]);

  if (loading || error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-container-lowest">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  return <>{children}</>;
}
