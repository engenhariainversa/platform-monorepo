import { gql } from "@apollo/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewerId, isSocketOperation, shouldRetrySocket, toWsUrl } from "./ws";

describe("toWsUrl", () => {
  it("derives the websocket URL from the HTTP endpoint", () => {
    expect(toWsUrl("http://localhost:4050/graphql")).toBe("ws://localhost:4050/graphql");
    expect(toWsUrl("https://api.engenhariainversa.com.br/graphql")).toBe("wss://api.engenhariainversa.com.br/graphql");
  });
  it("resolves a relative endpoint against the page origin", () => {
    expect(toWsUrl("/graphql", "https://engenhariainversa.com.br")).toBe("wss://engenhariainversa.com.br/graphql");
  });
});

describe("isSocketOperation", () => {
  it("routes subscriptions and the two high-frequency mutations over the socket", () => {
    expect(isSocketOperation(gql`subscription LiveEvents($slug: String!) { liveEvents(slug: $slug) { type } }`)).toBe(true);
    expect(isSocketOperation(gql`mutation MovePointer($p: ID!) { movePointer(presentationId: $p, x: 0, y: 0, visible: true) }`)).toBe(true);
    expect(isSocketOperation(gql`mutation SendReaction($s: String!) { sendReaction(slug: $s, kind: FIRE) }`)).toBe(true);
  });
  it("keeps everything else on HTTP", () => {
    expect(isSocketOperation(gql`query GetLiveState($slug: String!) { liveState(slug: $slug) { isLive } }`)).toBe(false);
    expect(isSocketOperation(gql`mutation StartLive($p: ID!, $s: ID!) { startLive(presentationId: $p, slideId: $s) { isLive } }`)).toBe(false);
    expect(isSocketOperation(gql`{ hello }`)).toBe(false);
  });
});

describe("shouldRetrySocket", () => {
  it("stops reconnecting after 4403 (revoked or expired credential) and retries otherwise", () => {
    expect(shouldRetrySocket({ code: 4403 })).toBe(false);
    expect(shouldRetrySocket({ code: 1006 })).toBe(true);
    expect(shouldRetrySocket(new Error("network"))).toBe(true);
  });
});

describe("getViewerId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is stable without localStorage (in-memory fallback)", () => {
    vi.stubGlobal("localStorage", undefined);
    const id = getViewerId();
    expect(id.length).toBeGreaterThan(8);
    expect(getViewerId()).toBe(id);
  });

  it("persists in localStorage so two tabs share one id", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const id = getViewerId();
    expect(store.get("ei_viewer_id")).toBe(id);
    expect(getViewerId()).toBe(id);
  });

  it("survives a storage that throws (private mode)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(getViewerId()).toBe(getViewerId());
  });
});
