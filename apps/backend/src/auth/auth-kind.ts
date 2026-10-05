import type { Role, User } from "@repo/database";

export type AuthKind = "jwt" | "apiKey";

/** `req.user` for both JWT sessions and API keys (a key acts as its creator). */
export type AuthenticatedUser = User & { role: Role; authKind?: AuthKind; apiKeyId?: string };

export function authKindOf(user: AuthenticatedUser | null | undefined): AuthKind | null {
  if (!user) return null;
  return user.authKind ?? "jwt";
}
