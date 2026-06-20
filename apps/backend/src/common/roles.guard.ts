import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { ROLES_KEY, RESOURCE_KEY } from "./roles.decorator";
import { PermissionsService } from "../permissions/permissions.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req?.user;

    // ── Check @Resource() decorator (new dynamic system) ──
    const resourceMeta = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(RESOURCE_KEY, [context.getHandler(), context.getClass()]);

    if (resourceMeta) {
      const userRole = user?.role
        ? { id: user.role.id, isAdmin: user.role.isAdmin }
        : undefined;

      return this.permissionsService.canAccess(
        resourceMeta.resource,
        resourceMeta.action,
        userRole,
      );
    }

    // ── Fallback: check @Roles() decorator (legacy) ──
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    if (!user) {
      return false;
    }

    // Admin (isAdmin flag) always has access
    if (user.role?.isAdmin) {
      return true;
    }

    return requiredRoles.includes(user.role?.name);
  }
}
