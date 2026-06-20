import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthPayload, LoginInput, SetupAdminInput } from "./auth.types";
import { GqlAuthGuard } from "./auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { UserType } from "../users/users.types";

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  async login(@Args("input") input: LoginInput): Promise<AuthPayload> {
    const result = await this.authService.login(
      input.identifier,
      input.password,
    );
    return result as unknown as AuthPayload;
  }

  @Mutation(() => AuthPayload)
  async setupAdmin(
    @Args("input") input: SetupAdminInput,
  ): Promise<AuthPayload> {
    const result = await this.authService.setupAdmin(input);
    return result as unknown as AuthPayload;
  }

  @Query(() => Boolean)
  async hasAdmin(): Promise<boolean> {
    return this.authService.hasAdmin();
  }

  @Query(() => UserType)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: UserType): Promise<UserType> {
    return user;
  }
}
