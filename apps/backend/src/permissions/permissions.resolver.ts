import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import {
  ResourcePermissions,
  PublicResourceType,
  TogglePermissionInput,
  TogglePublicResourceInput,
} from "./permissions.types";
import { GqlAuthGuard } from "../auth/auth.guard";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";

// Admin only: whoever can toggle permissions can grant themselves anything.
@Resolver()
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles("ADMIN")
export class PermissionsResolver {
  constructor(private permissionsService: PermissionsService) {}

  @Query(() => [ResourcePermissions])
  async permissionsForRole(@Args("roleId") roleId: string) {
    return this.permissionsService.getPermissionsForRole(roleId);
  }

  @Query(() => [PublicResourceType])
  async publicResources() {
    return this.permissionsService.getPublicResources();
  }

  @Query(() => [String])
  async availableResources() {
    return this.permissionsService.getAvailableResources();
  }

  @Mutation(() => Boolean)
  async togglePermission(@Args("input") input: TogglePermissionInput) {
    return this.permissionsService.togglePermission(
      input.roleId,
      input.resource,
      input.action,
    );
  }

  @Mutation(() => Boolean)
  async togglePublicResource(
    @Args("input") input: TogglePublicResourceInput,
  ) {
    return this.permissionsService.togglePublicResource(input.resource);
  }
}
