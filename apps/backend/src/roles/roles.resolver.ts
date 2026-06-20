import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { RoleType, CreateRoleInput, UpdateRoleInput } from "./roles.types";
import { GqlAuthGuard } from "../auth/auth.guard";

@Resolver()
@UseGuards(GqlAuthGuard)
export class RolesResolver {
  constructor(private rolesService: RolesService) {}

  @Query(() => [RoleType])
  async roles() {
    return this.rolesService.getRoles();
  }

  @Mutation(() => RoleType)
  async createRole(@Args("input") input: CreateRoleInput) {
    return this.rolesService.createRole(input);
  }

  @Mutation(() => RoleType)
  async updateRole(
    @Args("id") id: string,
    @Args("input") input: UpdateRoleInput,
  ) {
    return this.rolesService.updateRole(id, input);
  }

  @Mutation(() => Boolean)
  async deleteRole(@Args("id") id: string) {
    return this.rolesService.deleteRole(id);
  }
}
