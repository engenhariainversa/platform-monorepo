import { EventEmitter } from "events";
import { describe, expect, it } from "vitest";
import {
  clientIp,
  normalizeViewerId,
  originAllowed,
  SocketAuthService,
  type SocketContext,
} from "./socket-auth.service";
import { SocketRegistry } from "./socket-registry";

describe("clientIp", () => {
  it("prefers CF-Connecting-IP, then the first X-Forwarded-For hop, then the socket address", () => {
    expect(clientIp({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "8.8.8.8" }, "10.0.0.1")).toBe("9.9.9.9");
    expect(clientIp({ "x-forwarded-for": "8.8.8.8, 10.0.0.2" }, "10.0.0.1")).toBe("8.8.8.8");
    expect(clientIp({}, "10.0.0.1")).toBe("10.0.0.1");
    expect(clientIp({}, undefined)).toBe("unknown");
  });
});

describe("originAllowed", () => {
  it("allows everything when CORS_ORIGINS is not configured", () => {
    expect(originAllowed("https://evil.test", undefined)).toBe(true);
    expect(originAllowed("https://evil.test", [])).toBe(true);
  });
  it("allows listed origins and non-browser clients (no Origin header)", () => {
    const allowed = ["https://cms.test", "https://site.test"];
    expect(originAllowed("https://cms.test", allowed)).toBe(true);
    expect(originAllowed(undefined, allowed)).toBe(true);
  });
  it("rejects a browser origin that is not listed", () => {
    expect(originAllowed("https://evil.test", ["https://cms.test"])).toBe(false);
  });
});

describe("normalizeViewerId", () => {
  it("keeps a sane client id", () => {
    expect(normalizeViewerId("3f2a-viewer", "socket-1")).toBe("3f2a-viewer");
  });
  it("falls back to the socket id for missing or garbage values", () => {
    expect(normalizeViewerId(undefined, "socket-1")).toBe("socket-1");
    expect(normalizeViewerId("", "socket-1")).toBe("socket-1");
    expect(normalizeViewerId(42, "socket-1")).toBe("socket-1");
    expect(normalizeViewerId({ id: "x" }, "socket-1")).toBe("socket-1");
    expect(normalizeViewerId("x".repeat(10_000), "socket-1")).toBe("socket-1");
  });
});

describe("SocketAuthService.onConnect", () => {
  const OPEN = 1;
  const CLOSED = 3;

  function fakeSocket(readyState: number) {
    const socket = Object.assign(new EventEmitter(), { OPEN, readyState, close: () => {} });
    return socket;
  }

  function setup(readyStateAfterAuth: number) {
    const registry = new SocketRegistry();
    const socket = fakeSocket(OPEN);
    // The client goes away while the credential lookup is in flight.
    const apiKeys = {
      authenticate: async () => {
        socket.readyState = readyStateAfterAuth;
        return { id: "user-1" };
      },
    };
    const service = new SocketAuthService(registry, {} as never, {} as never, apiKeys as never, {} as never);
    const ctx = {
      connectionParams: { authorization: "Bearer ei_key" },
      extra: { socket, request: { headers: {}, socket: { remoteAddress: "1.1.1.1" } } },
    } as unknown as SocketContext;
    return { registry, socket, service, ctx };
  }

  it("does not register a socket that closed while authenticating", async () => {
    const { registry, service, ctx } = setup(CLOSED);
    expect(await service.onConnect(ctx)).toBe(false);
    expect(registry.countForIp("1.1.1.1")).toBe(0);
  });

  it("frees the slot when an acknowledged socket closes, even without onDisconnect", async () => {
    const { registry, socket, service, ctx } = setup(OPEN);
    expect(await service.onConnect(ctx)).toBe(true);
    expect(registry.countForIp("1.1.1.1")).toBe(1);
    socket.emit("close", 1000, "");
    expect(registry.countForIp("1.1.1.1")).toBe(0);
  });
});
