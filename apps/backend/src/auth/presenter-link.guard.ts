import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";

/**
 * Operations only a presenter link may call. Never pair it with RolesGuard: the
 * link resolves to its creator's user row, and RolesGuard would then grant the
 * creator's permissions.
 */
@Injectable()
export class GqlPresenterLinkGuard extends AuthGuard("presenter-link") {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }
}
