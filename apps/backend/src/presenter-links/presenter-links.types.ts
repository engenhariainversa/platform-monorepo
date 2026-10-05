import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";

export enum PresenterLinkExpiry {
  TWO_HOURS = "TWO_HOURS",
  TWELVE_HOURS = "TWELVE_HOURS",
  ONE_DAY = "ONE_DAY",
  SEVEN_DAYS = "SEVEN_DAYS",
}
registerEnumType(PresenterLinkExpiry, { name: "PresenterLinkExpiry" });

@ObjectType("PresenterLink")
export class PresenterLinkType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ description: "First 8 characters after eip_, for identification" })
  prefix!: string;

  @Field()
  expiresAt!: Date;

  @Field(() => Date, { nullable: true })
  lastUsedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  revokedAt!: Date | null;

  @Field()
  createdAt!: Date;
}

@ObjectType("CreatedPresenterLink")
export class CreatedPresenterLinkType {
  @Field(() => PresenterLinkType)
  presenterLink!: PresenterLinkType;

  @Field({ description: "The presenter page URL with the token in the fragment. Returned only here." })
  url!: string;
}
