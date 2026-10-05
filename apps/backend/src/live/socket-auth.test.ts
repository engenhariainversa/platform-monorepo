import { describe, expect, it } from "vitest";
import { clientIp, normalizeViewerId, originAllowed } from "./socket-auth.service";

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
