import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";

const STRATEGIES = ["api-key", "jwt"];

/** GraphQL operations that accept a CMS session or an API key. */
@Injectable()
export class GqlJwtOrApiKeyGuard extends AuthGuard(STRATEGIES) {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }
}

/** REST routes (uploads) that accept a CMS session or an API key. */
@Injectable()
export class HttpJwtOrApiKeyGuard extends AuthGuard(STRATEGIES) {}

/**
 * Never rejects a request without credentials (req.user = null), but a bad API
 * key still fails: an agent whose key expired must not be served as anonymous.
 */
@Injectable()
export class GqlOptionalAuthGuard extends AuthGuard(STRATEGIES) {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }

  handleRequest<TUser = any>(err: unknown, user: TUser | false): TUser | null {
    if (err) throw err;
    return user || null;
  }
}
