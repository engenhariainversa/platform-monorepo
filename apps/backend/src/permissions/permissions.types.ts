import { Field, ObjectType, InputType, ID } from "@nestjs/graphql";

@ObjectType()
export class PermissionType {
  @Field(() => ID)
  id!: string;

  @Field()
  resource!: string;

  @Field()
  action!: string;

  @Field()
  roleId!: string;
}

@ObjectType()
export class PublicResourceType {
  @Field(() => ID)
  id!: string;

  @Field()
  resource!: string;
}

@ObjectType()
export class ResourcePermissions {
  @Field()
  resource!: string;

  @Field()
  create!: boolean;

  @Field()
  read!: boolean;

  @Field()
  update!: boolean;

  @Field()
  delete!: boolean;
}

@InputType()
export class TogglePermissionInput {
  @Field()
  roleId!: string;

  @Field()
  resource!: string;

  @Field()
  action!: string;
}

@InputType()
export class TogglePublicResourceInput {
  @Field()
  resource!: string;
}
