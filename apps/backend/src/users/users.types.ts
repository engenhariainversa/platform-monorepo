import { Field, ObjectType, ID, InputType } from "@nestjs/graphql";
import { RoleType } from "../roles/roles.types";

@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  username!: string;

  @Field()
  roleId!: string;

  @Field(() => RoleType)
  role!: RoleType;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@InputType()
export class CreateUserInput {
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

  @Field({ nullable: true })
  roleName?: string;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  roleName?: string;
}
