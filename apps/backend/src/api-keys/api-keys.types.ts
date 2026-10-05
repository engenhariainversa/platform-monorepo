import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";

export enum ApiKeyExpiry {
  ONE_HOUR = "ONE_HOUR",
  ONE_DAY = "ONE_DAY",
  SEVEN_DAYS = "SEVEN_DAYS",
}
registerEnumType(ApiKeyExpiry, { name: "ApiKeyExpiry" });

@ObjectType("ApiKey")
export class ApiKeyType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ description: "First 8 characters after ei_, for identification" })
  prefix!: string;

  @Field()
  expiresAt!: Date;

  @Field({ nullable: true })
  lastUsedAt?: Date;

  @Field({ nullable: true })
  revokedAt?: Date;

  @Field()
  createdAt!: Date;
}

@ObjectType("CreatedApiKey")
export class CreatedApiKeyType {
  @Field(() => ApiKeyType)
  apiKey!: ApiKeyType;

  @Field({ description: "The full token. Returned only here; store it now." })
  token!: string;
}
