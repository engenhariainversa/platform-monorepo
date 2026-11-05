import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_SOCKETS_PER_IP, SocketRegistry } from "./socket-registry";

const entry = (socketId: string, ip = "1.1.1.1", extra: Record<string, unknown> = {}) => ({
  socketId,
  ip,
  close: vi.fn(),
  ...extra,
});

describe("SocketRegistry", () => {
  it("accepts up to 10 sockets per IP and refuses the 11th", () => {
    const registry = new SocketRegistry();
    for (let i = 0; i < MAX_SOCKETS_PER_IP; i++) expect(registry.add(entry(`s${i}`))).toBe(true);
    expect(registry.add(entry("s10"))).toBe(false);
    expect(registry.countForIp("1.1.1.1")).toBe(10);
    expect(registry.add(entry("other", "2.2.2.2"))).toBe(true);
  });

  it("frees the slot when a socket is removed and notifies listeners once", () => {
    const registry = new SocketRegistry();
    const removed: string[] = [];
    registry.onRemove((id) => removed.push(id));
    for (let i = 0; i < MAX_SOCKETS_PER_IP; i++) registry.add(entry(`s${i}`));
    registry.remove("s3");
    registry.remove("s3");
    expect(removed).toEqual(["s3"]);
    expect(registry.add(entry("again"))).toBe(true);
  });

  it("closes the sockets matching a predicate", () => {
    const registry = new SocketRegistry();
    const a = entry("a", "1.1.1.1", { presenterLinkId: "link-1" });
    const b = entry("b", "1.1.1.1", { presenterLinkId: "link-2" });
    registry.add(a);
    registry.add(b);
    expect(registry.closeWhere((e) => e.presenterLinkId === "link-1", 4403, "bye")).toBe(1);
    expect(a.close).toHaveBeenCalledWith(4403, "bye");
    expect(b.close).not.toHaveBeenCalled();
  });
});

describe("SocketRegistry — expiry", () => {
  afterEach(() => vi.useRealTimers());

  it("closes a socket with 4403 when its credential expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    const registry = new SocketRegistry();
    const link = entry("a", "1.1.1.1", { presenterLinkId: "link-1", expiresAt: new Date("2026-10-01T14:00:00Z") });
    const anonymous = entry("b");
    registry.add(link);
    registry.add(anonymous);

    vi.advanceTimersByTime(2 * 3600_000 - 1);
    expect(link.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(link.close).toHaveBeenCalledWith(4403, "Link revogado ou expirado");
    expect(anonymous.close).not.toHaveBeenCalled();
  });

  it("does not fire the expiry of a socket that already left", () => {
    vi.useFakeTimers();
    const registry = new SocketRegistry();
    const link = entry("a", "1.1.1.1", { expiresAt: new Date(Date.now() + 1000) });
    registry.add(link);
    registry.remove("a");
    vi.advanceTimersByTime(5000);
    expect(link.close).not.toHaveBeenCalled();
  });

  it("closes at once a socket whose credential is already expired", () => {
    vi.useFakeTimers();
    const registry = new SocketRegistry();
    const link = entry("a", "1.1.1.1", { expiresAt: new Date(Date.now() - 1) });
    registry.add(link);
    vi.advanceTimersByTime(0);
    expect(link.close).toHaveBeenCalledWith(4403, "Link revogado ou expirado");
  });

  it("keeps a timer for the longest expiry (7 days) without overflowing setTimeout", () => {
    vi.useFakeTimers();
    const registry = new SocketRegistry();
    const sevenDays = 7 * 24 * 3600_000;
    const link = entry("a", "1.1.1.1", { expiresAt: new Date(Date.now() + sevenDays) });
    registry.add(link);
    vi.advanceTimersByTime(sevenDays - 1);
    expect(link.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(link.close).toHaveBeenCalledWith(4403, "Link revogado ou expirado");
  });

  it("does not keep an expiry timer for a socket the cap refused", () => {
    vi.useFakeTimers();
    const registry = new SocketRegistry();
    for (let i = 0; i < MAX_SOCKETS_PER_IP; i++) registry.add(entry(`s${i}`));
    const refused = entry("x", "1.1.1.1", { expiresAt: new Date(Date.now() + 1000) });
    expect(registry.add(refused)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
