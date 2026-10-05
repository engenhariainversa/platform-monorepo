import type { INestApplication } from "@nestjs/common";
import { createClient, type Client } from "graphql-ws";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import type { GqlResponse } from "./helpers";

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Starts the HTTP server on a random port and returns the websocket URL. */
export async function listen(app: INestApplication): Promise<string> {
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  return `ws://127.0.0.1:${port}/graphql`;
}

/** `ws` lets tests send handshake headers (Origin, CF-Connecting-IP); browsers cannot. */
function socketImpl(headers?: Record<string, string>) {
  return class extends WebSocket {
    constructor(address: string | URL, protocols?: string | string[]) {
      super(address, protocols, { headers });
    }
  };
}

export function wsClient(
  url: string,
  connectionParams: Record<string, unknown> = {},
  headers?: Record<string, string>,
): Client {
  return createClient({ url, webSocketImpl: socketImpl(headers), connectionParams, retryAttempts: 0, lazy: true });
}

/** Connects eagerly. Resolves once acknowledged; `closed` resolves with the close code. */
export function openSocket(
  url: string,
  connectionParams: Record<string, unknown> = {},
  headers?: Record<string, string>,
): Promise<{ client: Client; closed: Promise<number> }> {
  return new Promise((resolve, reject) => {
    let resolveClosed: (code: number) => void = () => {};
    const closed = new Promise<number>((r) => (resolveClosed = r));
    let connected = false;
    const client = createClient({
      url,
      webSocketImpl: socketImpl(headers),
      connectionParams,
      retryAttempts: 0,
      lazy: false,
      onNonLazyError: () => {},
      on: {
        connected: () => {
          connected = true;
          resolve({ client, closed });
        },
        closed: (event) => {
          const code = (event as { code: number }).code;
          resolveClosed(code);
          if (!connected) reject(new Error(`socket closed before ack: ${code}`));
        },
      },
    });
  });
}

/** The close code of a connection the server refuses. */
export function closeCodeOf(
  url: string,
  connectionParams: Record<string, unknown> = {},
  headers?: Record<string, string>,
): Promise<number> {
  return openSocket(url, connectionParams, headers).then(
    ({ client }) => {
      void client.dispose();
      throw new Error("expected the server to refuse the socket");
    },
    (error: Error) => Number(/(\d+)$/.exec(error.message)?.[1]),
  );
}

/** A query or mutation over the socket, shaped like the HTTP helper's response. */
export function wsRequest<T = any>(
  client: Client,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GqlResponse<T>> {
  return new Promise((resolve, reject) => {
    let result: GqlResponse<T> = {};
    client.subscribe<T>(
      { query, variables },
      {
        next: (value) => (result = value as GqlResponse<T>),
        error: (error) => (Array.isArray(error) ? resolve({ errors: error }) : reject(error)),
        complete: () => resolve(result),
      },
    );
  });
}

export function subscribeTo<T = any>(client: Client, query: string, variables?: Record<string, unknown>) {
  const events: T[] = [];
  const errors: unknown[] = [];
  const stop = client.subscribe<T>(
    { query, variables },
    {
      next: (value) => {
        if (value.errors) errors.push(...value.errors);
        if (value.data) events.push(value.data as T);
      },
      error: (error) => errors.push(error),
      complete: () => {},
    },
  );
  return {
    events,
    errors,
    stop,
    /** Polls until `predicate(events)` holds; fails with what was received otherwise. */
    async waitUntil(predicate: (events: T[]) => boolean, timeoutMs = 5000): Promise<T[]> {
      const deadline = Date.now() + timeoutMs;
      while (!predicate(events)) {
        if (errors.length) throw new Error(`subscription error: ${JSON.stringify(errors)}`);
        if (Date.now() > deadline) throw new Error(`condition not met; events: ${JSON.stringify(events)}`);
        await sleep(20);
      }
      return events;
    },
    waitFor(count: number, timeoutMs = 5000): Promise<T[]> {
      return this.waitUntil((received) => received.length >= count, timeoutMs);
    },
  };
}
