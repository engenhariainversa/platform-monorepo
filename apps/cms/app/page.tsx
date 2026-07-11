"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@repo/graphql/react";
import { HAS_ADMIN, hasAuthToken } from "@repo/graphql";

export default function Home() {
  const router = useRouter();
  const { data, error, loading } = useQuery<{ hasAdmin: boolean }>(HAS_ADMIN, {
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (loading) return;

    // If backend is down, show login
    if (error) {
      router.replace("/login");
      return;
    }

    if (!data) return;

    if (!data.hasAdmin) {
      router.replace("/setup");
    } else if (!hasAuthToken()) {
      router.replace("/login");
    } else {
      router.replace("/dashboard");
    }
  }, [data, error, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
