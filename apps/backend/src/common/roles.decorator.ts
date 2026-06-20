import { SetMetadata } from "@nestjs/common";

// Legacy: hardcoded role check (backwards compatibility)
export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// New: dynamic resource-based permission check
export const RESOURCE_KEY = "resource";
export const Resource = (resource: string, action: string) =>
  SetMetadata(RESOURCE_KEY, { resource, action });
