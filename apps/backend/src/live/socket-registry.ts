import { Injectable } from "@nestjs/common";
import { LINK_GONE } from "../presenter-links/presenter-links.service";

export const MAX_SOCKETS_PER_IP = 10;
/** Invalid, revoked or expired credential; foreign origin. Clients stop reconnecting. */
export const CLOSE_FORBIDDEN = 4403;
/** More than MAX_SOCKETS_PER_IP concurrent sockets from one IP. */
export const CLOSE_TOO_MANY = 4429;

export interface SocketEntry {
  socketId: string;
  ip: string;
  close: (code: number, reason: string) => void;
  /** Set when the socket authenticated with a presenter link. */
  presenterLinkId?: string;
  /** The deck a presenter link controls; its sockets close when the deck is trashed. */
  presenterPresentationId?: string;
  /** When set, the socket is closed with 4403 at this instant (Task 7). */
  expiresAt?: Date;
}

/** Every acknowledged websocket. In memory: one backend instance (spec §3.2). */
@Injectable()
export class SocketRegistry {
  private readonly sockets = new Map<string, SocketEntry>();
  private readonly removeListeners = new Set<(socketId: string) => void>();
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  add(entry: SocketEntry): boolean {
    if (this.countForIp(entry.ip) >= MAX_SOCKETS_PER_IP) return false;
    this.sockets.set(entry.socketId, entry);
    if (entry.expiresAt) {
      // Longest expiry is 7 days, well inside setTimeout's ~24.8-day limit.
      const wait = Math.max(0, entry.expiresAt.getTime() - Date.now());
      this.expiryTimers.set(
        entry.socketId,
        setTimeout(() => entry.close(CLOSE_FORBIDDEN, LINK_GONE), wait),
      );
    }
    return true;
  }

  remove(socketId: string): void {
    if (!this.sockets.delete(socketId)) return;
    const timer = this.expiryTimers.get(socketId);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(socketId);
    for (const listener of this.removeListeners) listener(socketId);
  }

  countForIp(ip: string): number {
    let count = 0;
    for (const entry of this.sockets.values()) if (entry.ip === ip) count += 1;
    return count;
  }

  closeWhere(predicate: (entry: SocketEntry) => boolean, code: number, reason: string): number {
    let closed = 0;
    for (const entry of [...this.sockets.values()]) {
      if (!predicate(entry)) continue;
      entry.close(code, reason);
      closed += 1;
    }
    return closed;
  }

  onRemove(listener: (socketId: string) => void): void {
    this.removeListeners.add(listener);
  }
}
