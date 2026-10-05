import { HttpException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import type { IncomingHttpHeaders, IncomingMessage } from "http";
import type { ExecutionResult, FormattedExecutionResult } from "graphql";
import type { Context } from "graphql-ws";
import type { WebSocket } from "ws";
import { ApiKeysService } from "../api-keys/api-keys.service";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { AuthService } from "../auth/auth.service";
import { PresenterLinksService } from "../presenter-links/presenter-links.service";
import { CLOSE_TOO_MANY, SocketRegistry } from "./socket-registry";

/** What the server knows about one acknowledged socket. */
export interface SocketSession {
  socketId: string;
  ip: string;
  /** Client-chosen (localStorage); used only to count a browser once. Never trusted for limits. */
  viewerId: string;
  /** The `Authorization` value sent in connectionParams, replayed on every operation. */
  authorization: string | null;
}

export interface SocketExtra {
  socket: WebSocket;
  request: IncomingMessage;
  session?: SocketSession;
}
export type SocketContext = Context<Record<string, unknown> | undefined, SocketExtra>;

/** The `req` resolvers and guards see for an operation that arrived over a socket. */
export interface SocketRequest {
  headers: { authorization?: string };
  socketSession: SocketSession;
  user?: AuthenticatedUser | null;
  livePresenter?: boolean;
}

const MAX_VIEWER_ID = 64;

export function clientIp(headers: IncomingHttpHeaders, remoteAddress: string | undefined): string {
  const cf = headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const forwarded = headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  if (first) return first;
  return remoteAddress ?? "unknown";
}

/**
 * Browsers always send Origin on a websocket handshake; a missing header means a
 * non-browser client (wscat, tests), which a CORS-style check does not concern.
 */
export function originAllowed(origin: string | undefined, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!origin) return true;
  return allowed.includes(origin);
}

export function normalizeViewerId(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_VIEWER_ID) return fallback;
  return value;
}

/** Same mapping @nestjs/apollo applies over HTTP (autoTransformHttpErrors). */
const HTTP_ERROR_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  422: "BAD_USER_INPUT",
};

/**
 * Apollo's formatError (where Nest turns an HttpException into
 * `extensions.code`) only runs for HTTP operations. graphql-ws calls this from
 * `onNext`, so a socket client sees the same codes (UNAUTHENTICATED, FORBIDDEN…).
 */
export function formatSocketResult(result: ExecutionResult): FormattedExecutionResult | void {
  if (!result.errors?.length) return;
  return {
    ...result,
    errors: result.errors.map((error) => {
      const formatted = error.toJSON();
      const exception = error.originalError;
      // A variable that does not coerce (e.g. an unknown enum value): Apollo answers
      // BAD_USER_INPUT over HTTP. graphql-js reports it before execution starts (no `data`).
      if (!("data" in result) && !formatted.extensions?.code && error.message.startsWith('Variable "$')) {
        return { ...formatted, extensions: { ...formatted.extensions, code: "BAD_USER_INPUT" } };
      }
      if (!(exception instanceof HttpException)) return formatted;
      const status = exception.getStatus();
      const code = HTTP_ERROR_CODES[status];
      return {
        ...formatted,
        extensions: {
          ...formatted.extensions,
          ...(code ? { code } : { code: "INTERNAL_SERVER_ERROR", status }),
          originalError: exception.getResponse(),
        },
      };
    }),
  };
}

function corsOrigins(): string[] | undefined {
  return process.env.CORS_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly registry: SocketRegistry,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeysService,
    private readonly presenterLinks: PresenterLinksService,
  ) {}

  /** Same credentials as the HTTP strategies. null = anonymous viewer. */
  async authenticate(authorization: string | null): Promise<AuthenticatedUser | null> {
    if (!authorization) return null;
    const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
    if (!token) throw new UnauthorizedException("Credencial inválida");
    if (token.startsWith("eip_")) return this.presenterLinks.authenticate(token);
    if (token.startsWith("ei_")) return this.apiKeys.authenticate(token);

    let payload: { sub: string };
    try {
      payload = this.jwt.verify<{ sub: string }>(token);
    } catch {
      throw new UnauthorizedException("Sessão inválida");
    }
    const user = await this.auth.validateUserById(payload.sub);
    if (!user) throw new UnauthorizedException("Sessão inválida");
    return user as AuthenticatedUser;
  }

  /** Returning false makes graphql-ws close the socket with 4403 (Forbidden). */
  async onConnect(ctx: SocketContext): Promise<boolean> {
    const { socket, request } = ctx.extra;
    if (!originAllowed(request.headers.origin, corsOrigins())) return false;

    const params = ctx.connectionParams ?? {};
    const authorization =
      typeof params.authorization === "string" && params.authorization ? params.authorization : null;
    let user: AuthenticatedUser | null;
    try {
      user = await this.authenticate(authorization);
    } catch {
      return false;
    }

    const socketId = randomUUID();
    const session: SocketSession = {
      socketId,
      ip: clientIp(request.headers, request.socket.remoteAddress),
      viewerId: normalizeViewerId(params.viewerId, socketId),
      authorization,
    };
    const accepted = this.registry.add({
      socketId,
      ip: session.ip,
      close: (code, reason) => socket.close(code, reason),
      presenterLinkId: user?.presenterLinkId,
      expiresAt: user?.presenterLinkExpiresAt,
    });
    if (!accepted) {
      socket.close(CLOSE_TOO_MANY, "Too many connections");
      return false;
    }
    // graphql-ws skips onDisconnect for a socket that closes before it is
    // acknowledged, i.e. while the credential lookup above was in flight.
    if (socket.readyState !== socket.OPEN) {
      this.registry.remove(socketId);
      return false;
    }
    socket.once("close", () => this.registry.remove(socketId));
    ctx.extra.session = session;
    return true;
  }

  onDisconnect(ctx: SocketContext): void {
    const session = ctx.extra.session;
    if (session) this.registry.remove(session.socketId);
  }

  /**
   * A fresh `req` per operation. It carries the Authorization header, so the
   * passport guards validate the credential again on every operation.
   */
  context(ctx: SocketContext): { req: SocketRequest } {
    const session = ctx.extra.session as SocketSession;
    return {
      req: {
        headers: session.authorization ? { authorization: session.authorization } : {},
        socketSession: session,
      },
    };
  }
}
