import type { Role, User } from "@repo/database";

export type AuthKind = "jwt" | "apiKey" | "presenterLink";

/**
 * `req.user` for JWT sessions, API keys and presenter links. A key or a link
 * resolves to its creator's user row; `authKind` says which credential was
 * presented, and guards decide what that credential may do.
 */
export type AuthenticatedUser = User & {
  role: Role;
  authKind?: AuthKind;
  apiKeyId?: string;
  presenterLinkId?: string;
  /** The only presentation a presenter link may read and control. */
  presenterPresentationId?: string;
  presenterLinkExpiresAt?: Date;
};

export function authKindOf(user: AuthenticatedUser | null | undefined): AuthKind | null {
  if (!user) return null;
  return user.authKind ?? "jwt";
}
