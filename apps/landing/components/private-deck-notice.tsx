import Link from "next/link";

/**
 * What /apresentacoes/<slug> shows when the deck is private, members-only, in
 * the trash or does not exist: one page for all of them, so it says nothing
 * about which. Served as a 200, not a 404, so chat apps and X render the fixed
 * share card: a preview of a 404 is unreliable (Twitterbot treats a non-200
 * fetch as a failure). `noindex` keeps it out of search.
 */
export function PrivateDeckNotice() {
  return (
    <main className="min-h-screen flex items-center justify-center px-margin-mobile">
      <div className="max-w-md text-center space-y-md">
        <h1 className="font-headline text-3xl font-extrabold text-on-surface">Apresentação privada</h1>
        <p className="font-body text-on-surface-variant">
          Esta apresentação não está disponível publicamente.
        </p>
        <Link href="/" className="inline-block font-body font-semibold text-primary underline">
          Ir para o Engenharia Inversa
        </Link>
      </div>
    </main>
  );
}
