import {
  Field,
  ObjectType,
  ID,
  InputType,
  registerEnumType,
} from "@nestjs/graphql";

export enum Role {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  AUTHENTICATED = "AUTHENTICATED",
}

registerEnumType(Role, { name: "Role" });

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

  @Field(() => Role)
  role!: Role;

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

  @Field(() => Role, { nullable: true, defaultValue: Role.AUTHENTICATED })
  role?: Role;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field(() => Role, { nullable: true })
  role?: Role;
}
