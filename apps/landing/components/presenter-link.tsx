"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GET_PRESENTATION_FOR_PRESENTER,
  GET_SOCIAL_LINKS,
  GRAPHQL_URL,
  PRESENTER_TOKEN_STORAGE_KEY,
  SOCKET_CLOSE_FORBIDDEN,
  createApolloClient,
  extractPresenterToken,
  getUploadUrl,
  isUnauthenticatedError,
} from "@repo/graphql";
import { ApolloProvider, useLiveSession, usePresenterControls, useQuery } from "@repo/graphql/react";
import type { Presentation, SocialLink } from "@repo/types";
import { LivePresenterPlayer, LivePresenterView, type PlayerSlide, type SlideContext } from "@repo/ui";

/**
 * The token arrives in the URL fragment (never sent to a server). It is moved
 * to sessionStorage — so a reload and the presenter popup (which inherits a
 * copy of this tab's sessionStorage) keep working — and wiped from the address bar.
 */
function readPresenterToken(): string | null {
  const fromHash = extractPresenterToken(window.location.hash);
  if (fromHash) {
    try {
      sessionStorage.setItem(PRESENTER_TOKEN_STORAGE_KEY, fromHash);
    } catch {
      // Storage blocked: the token still works for this page load.
    }
    history.replaceState(null, "", window.location.pathname);
    return fromHash;
  }
  try {
    return sessionStorage.getItem(PRESENTER_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function LinkGone() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-surface-container-lowest p-8 text-center">
      <h1 className="font-headline text-3xl font-bold text-on-surface">Link revogado ou expirado</h1>
      <p className="max-w-md text-on-surface-variant">
        Peça um novo link de apresentador a quem compartilhou esta apresentação.
      </p>
    </div>
  );
}

/**
 * An Apollo client of its own, authenticated with the presenter link over HTTP
 * and over the socket. A 4403 close (link revoked or expired while the page is
 * open) replaces everything with the "gone" screen.
 */
export function PresenterLinkProvider({ children }: { children: ReactNode }) {
  // undefined = not read yet (first client render); null = no token.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [gone, setGone] = useState(false);

  useEffect(() => setToken(readPresenterToken()), []);

  const client = useMemo(
    () =>
      token
        ? createApolloClient({
            uri: GRAPHQL_URL,
            getToken: () => token,
            live: {
              onClosed: (code) => {
                if (code === SOCKET_CLOSE_FORBIDDEN) setGone(true);
              },
            },
          })
        : null,
    [token],
  );

  // Render nothing until the token left the address bar: the player writes the
  // slide number to the hash and must not see "#t=…".
  if (token === undefined) return null;
  if (!client || gone) return <LinkGone />;
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

function LiveDeck({
  presentation,
  slides,
  context,
  view,
}: {
  presentation: Presentation;
  slides: PlayerSlide[];
  context: SlideContext;
  view: "player" | "presenter";
}) {
  const isPublic = presentation.visibility === "PUBLIC";
  const live = useLiveSession(isPublic ? presentation.slug : null, { pollMs: 5000 });
  const controls = usePresenterControls(presentation.id);

  if (view === "presenter") {
    return (
      <LivePresenterView
        presentationId={presentation.id}
        title={presentation.title}
        slides={slides}
        context={context}
        live={live}
        controls={controls}
      />
    );
  }
  return (
    <LivePresenterPlayer
      presentationId={presentation.id}
      slides={slides}
      context={context}
      presenterHref="/apresentacoes/controle/apresentador"
      isPublic={isPublic}
      live={live}
      controls={controls}
    />
  );
}

/** The link's presentation, as the projected player or as the presenter window. */
export function PresenterLinkDeck({ view }: { view: "player" | "presenter" }) {
  // Polled: a revoked or expired link is noticed even on a private deck, which
  // opens no socket; and edits made in the CMS reach this machine.
  const { data, error } = useQuery<{ presentationForPresenter: Presentation }>(GET_PRESENTATION_FOR_PRESENTER, {
    fetchPolicy: "network-only",
    pollInterval: 30_000,
  });
  const { data: social } = useQuery<{ socialLinks: SocialLink[] }>(GET_SOCIAL_LINKS);

  const presentation = data?.presentationForPresenter ?? null;
  const slides = useMemo<PlayerSlide[]>(
    () =>
      [...(presentation?.slides ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, template: s.template, content: s.content, notes: s.notes, hidden: s.hidden })),
    [presentation],
  );
  const context = useMemo<SlideContext>(
    () => ({
      socialLinks: [...(social?.socialLinks ?? [])].sort((a, b) => a.order - b.order),
      resolveUrl: (url) => getUploadUrl(url),
    }),
    [social],
  );

  if (isUnauthenticatedError(error)) return <LinkGone />;
  if (!presentation) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-container-lowest text-on-surface-variant">
        {error ? "Não foi possível carregar a apresentação. Tentando de novo…" : "Carregando…"}
      </div>
    );
  }
  return <LiveDeck presentation={presentation} slides={slides} context={context} view={view} />;
}
