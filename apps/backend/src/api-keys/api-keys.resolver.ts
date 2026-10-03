import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { GqlAuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { CurrentUser } from "../common/current-user.decorator";
import { Resource } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { ApiKeysService } from "./api-keys.service";
import { ApiKeyExpiry, ApiKeyType, CreatedApiKeyType } from "./api-keys.types";

// JWT only (GqlAuthGuard): an API key can never list, mint or revoke keys.
@Resolver()
export class ApiKeysResolver {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Query(() => [ApiKeyType])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("apiKeys", "read")
  apiKeys() {
    return this.apiKeys.list();
  }

  @Mutation(() => CreatedApiKeyType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("apiKeys", "create")
  createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Args("name") name: string,
    @Args("expiresIn", { type: () => ApiKeyExpiry }) expiresIn: ApiKeyExpiry,
  ) {
    return this.apiKeys.create(user.id, name, expiresIn);
  }

  @Mutation(() => ApiKeyType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("apiKeys", "update")
  revokeApiKey(@Args("id", { type: () => ID }) id: string) {
    return this.apiKeys.revoke(id);
  }
}
