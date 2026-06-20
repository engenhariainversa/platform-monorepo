import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UserType, CreateUserInput, UpdateUserInput } from "./users.types";
import { GqlAuthGuard } from "../auth/auth.guard";
import { Resource } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";

@Resolver(() => UserType)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserType])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("users", "read")
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
  @Resource("users", "create")
  async createUser(@Args("input") input: CreateUserInput): Promise<UserType> {
    return this.usersService.create(input) as unknown as UserType;
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("users", "update")
  async updateUser(
    @Args("id") id: string,
    @Args("input") input: UpdateUserInput,
  ): Promise<UserType> {
    return this.usersService.update(id, input) as unknown as UserType;
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("users", "update")
  async updateUserRole(
    @Args("id") id: string,
    @Args("roleName") roleName: string,
  ): Promise<UserType> {
    return this.usersService.updateRole(id, roleName) as unknown as UserType;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("users", "delete")
  async deleteUser(@Args("id") id: string): Promise<boolean> {
    await this.usersService.delete(id);
    return true;
  }
}
