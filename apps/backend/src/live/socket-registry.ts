import { Injectable } from "@nestjs/common";

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
  /** When set, the socket is closed with 4403 at this instant (Task 7). */
  expiresAt?: Date;
}

/** Every acknowledged websocket. In memory: one backend instance (spec §3.2). */
@Injectable()
export class SocketRegistry {
  private readonly sockets = new Map<string, SocketEntry>();
  private readonly removeListeners = new Set<(socketId: string) => void>();

  add(entry: SocketEntry): boolean {
    if (this.countForIp(entry.ip) >= MAX_SOCKETS_PER_IP) return false;
    this.sockets.set(entry.socketId, entry);
    return true;
  }

  remove(socketId: string): void {
    if (!this.sockets.delete(socketId)) return;
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
