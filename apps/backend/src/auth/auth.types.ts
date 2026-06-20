import { Field, ObjectType, InputType } from "@nestjs/graphql";
import { UserType } from "../users/users.types";

@ObjectType()
export class AuthPayload {
  @Field()
  token!: string;

  @Field(() => UserType)
  user!: UserType;
}

@InputType()
export class LoginInput {
  @Field()
  identifier!: string; // email or username

  @Field()
  password!: string;
}

@InputType()
export class SetupAdminInput {
  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  username!: string;

  @Field()
  password!: string;
}
