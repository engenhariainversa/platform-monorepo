"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { graphqlRequest, isAuthenticated } from "../lib/graphql-client";
import { HAS_ADMIN } from "../lib/queries";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await graphqlRequest<{ hasAdmin: boolean }>(HAS_ADMIN);

        if (!data.hasAdmin) {
          router.replace("/setup");
          return;
        }

        if (!isAuthenticated()) {
          router.replace("/login");
          return;
        }

        router.replace("/dashboard");
      } catch {
        // If backend is down, show login
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return null;
}
