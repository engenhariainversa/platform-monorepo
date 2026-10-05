import type { ApiKey } from "@repo/types";

export type ApiKeyStatus = "active" | "expired" | "revoked";

export const API_KEY_STATUS_LABEL: Record<ApiKeyStatus, string> = {
  active: "Ativa",
  expired: "Expirada",
  revoked: "Revogada",
};

export function apiKeyStatus(
  key: Pick<ApiKey, "expiresAt" | "revokedAt">,
  now: number = Date.now(),
): ApiKeyStatus {
  if (key.revokedAt) return "revoked";
  return Date.parse(key.expiresAt) <= now ? "expired" : "active";
}
