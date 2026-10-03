import { createHash, randomBytes } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A new bearer token. Only `hash` is stored; `token` is shown to the user once. */
export function generateToken(prefix: "ei_"): { token: string; hash: string; displayPrefix: string } {
  const secret = randomBytes(32).toString("base64url");
  const token = `${prefix}${secret}`;
  return { token, hash: hashToken(token), displayPrefix: secret.slice(0, 8) };
}
