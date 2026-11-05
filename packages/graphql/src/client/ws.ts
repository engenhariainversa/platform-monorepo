import { Kind, OperationTypeNode, type DocumentNode } from "graphql";

/**
 * Mutations sent over the socket instead of HTTP: they are frequent (pointer)
 * or rate-limited per socket (reactions). Matched by operation name.
 */
export const SOCKET_OPERATIONS = ["MovePointer", "SendReaction"];

/** The server closed the socket for good: revoked/expired credential or foreign origin. */
export const SOCKET_CLOSE_FORBIDDEN = 4403;

/** The server refused the socket: too many concurrent sockets from one IP. Not retried. */
export const SOCKET_CLOSE_TOO_MANY = 4429;

/** Ceiling of the reconnect wait, and the random extra on top of it. */
export const SOCKET_RETRY_MAX_MS = 30_000;
export const SOCKET_RETRY_JITTER_MS = 1_000;

/** Reconnect wait: 1 s, 2 s, 4 s … capped at 30 s, plus up to 1 s of jitter. */
export function retryDelayMs(retries: number, random: () => number = Math.random): number {
  return Math.min(2 ** retries * 1000, SOCKET_RETRY_MAX_MS) + random() * SOCKET_RETRY_JITTER_MS;
}

const VIEWER_ID_KEY = "ei_viewer_id";
let memoryViewerId: string | null = null;

/** `http→ws`, `https→wss`. No extra environment variable needed. */
export function toWsUrl(httpUrl: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  const url = new URL(httpUrl, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function isSocketOperation(query: DocumentNode): boolean {
  for (const definition of query.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
    if (definition.operation === OperationTypeNode.SUBSCRIPTION) return true;
    return SOCKET_OPERATIONS.includes(definition.name?.value ?? "");
  }
  return false;
}

/** graphql-ws `shouldRetry`: keep reconnecting unless the server said "forbidden". */
export function shouldRetrySocket(event: unknown): boolean {
  return (event as { code?: number } | null)?.code !== SOCKET_CLOSE_FORBIDDEN;
}

function newViewerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * A random id per browser, so two tabs count as one viewer. Not an identity:
 * the server only uses it to de-duplicate the audience counter.
 */
export function getViewerId(): string {
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      const stored = storage.getItem(VIEWER_ID_KEY);
      if (stored) return stored;
      const created = newViewerId();
      storage.setItem(VIEWER_ID_KEY, created);
      return created;
    }
  } catch {
    // Storage blocked (private mode, sandboxed iframe): fall back to memory.
  }
  return (memoryViewerId ??= newViewerId());
}
