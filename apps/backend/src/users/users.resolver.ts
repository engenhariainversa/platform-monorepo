import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UserType, CreateUserInput, UpdateUserInput, Role } from "./users.types";
import { GqlAuthGuard } from "../auth/auth.guard";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";

@Resolver(() => UserType)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserType])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async users(): Promise<UserType[]> {
    return this.usersService.findAll() as unknown as UserType[];
  }

  @Query(() => UserType, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async user(@Args("id") id: string): Promise<UserType | null> {
    return this.usersService.findById(id) as unknown as UserType | null;
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createUser(@Args("input") input: CreateUserInput): Promise<UserType> {
    return this.usersService.create(input) as unknown as UserType;
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateUser(
    @Args("id") id: string,
    @Args("input") input: UpdateUserInput,
  ): Promise<UserType> {
    return this.usersService.update(id, input) as unknown as UserType;
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateUserRole(
    @Args("id") id: string,
    @Args("role", { type: () => Role }) role: Role,
  ): Promise<UserType> {
    return this.usersService.updateRole(id, role) as unknown as UserType;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteUser(@Args("id") id: string): Promise<boolean> {
    await this.usersService.delete(id);
    return true;
  }
}
