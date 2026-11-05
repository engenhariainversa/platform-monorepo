import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { PermissionsService } from "../permissions/permissions.service";

/**
 * Live controls: a CMS session with presentations:update, or the presenter
 * link of that very presentation (`presentationId` argument). API keys are not
 * accepted: "api-key" is deliberately absent from the strategy list.
 */
@Injectable()
export class GqlLiveControlGuard extends AuthGuard(["presenter-link", "jwt"]) {
  constructor(private readonly permissions: PermissionsService) {
    super();
  }

  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context); // throws 401 without a valid credential
    const gql = GqlExecutionContext.create(context);
    const user = gql.getContext().req.user as AuthenticatedUser;
    const { presentationId } = gql.getArgs<{ presentationId: string }>();

    if (user.authKind === "presenterLink") {
      if (user.presenterPresentationId !== presentationId) {
        throw new UnauthorizedException("Este link não controla esta apresentação");
      }
      return true;
    }
    const allowed = await this.permissions.canAccess("presentations", "update", {
      id: user.role.id,
      isAdmin: user.role.isAdmin,
    });
    if (!allowed) throw new ForbiddenException();
    return true;
  }
}

/**
 * Public live reads. Anonymous callers pass with `req.user = null`; a dead
 * credential still fails, so a revoked presenter link is never served as a viewer.
 */
@Injectable()
export class GqlOptionalLiveGuard extends AuthGuard(["presenter-link", "api-key", "jwt"]) {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }

  handleRequest<TUser = any>(err: unknown, user: TUser | false): TUser | null {
    if (err) throw err;
    return user || null;
  }
}
