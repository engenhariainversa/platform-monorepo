"use client";

import { useParams } from "next/navigation";
import { PrintDeck } from "@repo/ui";
import { useDeck } from "../../../../components/presentations/use-deck";

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id, { fresh: true });

  // Wait for the social links too: printing must not start before every slide
  // has its final content.
  if (loading || !presentation) return null;
  return <PrintDeck slides={slides} context={context} />;
}
