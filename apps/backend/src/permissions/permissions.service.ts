import { Injectable } from "@nestjs/common";
import { prisma } from "@repo/database";

const RESOURCES = ["about", "live", "episodes", "users", "pages"];
const ACTIONS = ["create", "read", "update", "delete"];

@Injectable()
export class PermissionsService {
  /**
   * Get all permissions for a specific role, organized by resource.
   */
  async getPermissionsForRole(roleId: string) {
    const permissions = await prisma.permission.findMany({
      where: { roleId },
    });

    const permSet = new Set(
      permissions.map((p) => `${p.resource}:${p.action}`),
    );

    return RESOURCES.map((resource) => ({
      resource,
      create: permSet.has(`${resource}:create`),
      read: permSet.has(`${resource}:read`),
      update: permSet.has(`${resource}:update`),
      delete: permSet.has(`${resource}:delete`),
    }));
  }

  /**
   * Toggle a permission on/off for a role.
   * Returns true if enabled, false if disabled.
   */
  async togglePermission(
    roleId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const existing = await prisma.permission.findUnique({
      where: {
        resource_action_roleId: { resource, action, roleId },
      },
    });

    if (existing) {
      await prisma.permission.delete({ where: { id: existing.id } });
      return false;
    } else {
      await prisma.permission.create({
        data: { resource, action, roleId },
      });
      return true;
    }
  }

  /**
   * Get all public resources.
   */
  async getPublicResources() {
    return prisma.publicResource.findMany();
  }

  /**
   * Toggle public access for a resource.
   * Returns true if now public, false if now private.
   */
  async togglePublicResource(resource: string): Promise<boolean> {
    const existing = await prisma.publicResource.findUnique({
      where: { resource },
    });

    if (existing) {
      await prisma.publicResource.delete({ where: { id: existing.id } });
      return false;
    } else {
      await prisma.publicResource.create({ data: { resource } });
      return true;
    }
  }

  /**
   * Check if a user (or public) can access a resource+action.
   * Used by the dynamic guard.
   */
  async canAccess(
    resource: string,
    action: string,
    userRole?: { id: string; isAdmin: boolean },
  ): Promise<boolean> {
    // Admin always has access
    if (userRole?.isAdmin) {
      return true;
    }

    // Check public access for reads
    if (action === "read") {
      const publicResource = await prisma.publicResource.findUnique({
        where: { resource },
      });
      if (publicResource) return true;
    }

    // No user = no access (unless public, checked above)
    if (!userRole) {
      return false;
    }

    // Check role permission
    const permission = await prisma.permission.findUnique({
      where: {
        resource_action_roleId: {
          resource,
          action,
          roleId: userRole.id,
        },
      },
    });

    return !!permission;
  }

  /**
   * Get available resources and actions for the settings UI.
   */
  getAvailableResources() {
    return RESOURCES;
  }

  getAvailableActions() {
    return ACTIONS;
  }
}
