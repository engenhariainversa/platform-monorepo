import { Field, ObjectType, InputType, ID } from "@nestjs/graphql";

@ObjectType()
export class RoleType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  label!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isSystem!: boolean;

  @Field()
  isAdmin!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => Number, { nullable: true })
  userCount?: number;
}

@InputType()
export class CreateRoleInput {
  @Field()
  name!: string;

  @Field()
  label!: string;

  @Field({ nullable: true })
  description?: string;
}

@InputType()
export class UpdateRoleInput {
  @Field({ nullable: true })
  label?: string;

  @Field({ nullable: true })
  description?: string;
}
