import { describe, expect, it, vi } from "vitest";
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
