import { Field, ID, InputType, Int, ObjectType, registerEnumType } from "@nestjs/graphql";
import GraphQLJSON from "graphql-type-json";

export enum PresentationVisibilityEnum {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
  MEMBERS = "MEMBERS",
}
registerEnumType(PresentationVisibilityEnum, { name: "PresentationVisibility" });

@ObjectType("Slide")
export class SlideType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  order!: number;

  @Field()
  template!: string;

  @Field(() => GraphQLJSON)
  content!: Record<string, unknown>;

  @Field(() => String, { nullable: true, description: "null for anonymous readers" })
  notes!: string | null;

  @Field()
  hidden!: boolean;
}

@ObjectType("Presentation")
export class PresentationType {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => PresentationVisibilityEnum)
  visibility!: PresentationVisibilityEnum;

  @Field(() => [SlideType], { description: "Ordered; hidden slides omitted for anonymous readers" })
  slides!: SlideType[];

  @Field(() => Date, { nullable: true })
  deletedAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType("SlideTemplateInfo")
export class SlideTemplateInfoType {
  @Field()
  key!: string;

  @Field()
  label!: string;

  @Field()
  description!: string;

  @Field(() => GraphQLJSON)
  jsonSchema!: Record<string, unknown>;

  @Field(() => GraphQLJSON)
  example!: Record<string, unknown>;
}

@InputType()
export class SlideInput {
  @Field()
  template!: string;

  @Field(() => GraphQLJSON)
  content!: unknown;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field(() => Boolean, { nullable: true })
  hidden?: boolean | null;
}

@InputType()
export class CreatePresentationInput {
  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  slug?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => PresentationVisibilityEnum, { nullable: true })
  visibility?: PresentationVisibilityEnum | null;

  @Field(() => [SlideInput], { nullable: true })
  slides?: SlideInput[] | null;
}

@InputType()
export class UpdatePresentationInput {
  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  slug?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => PresentationVisibilityEnum, { nullable: true })
  visibility?: PresentationVisibilityEnum | null;
}

@InputType()
export class UpdateSlideInput {
  @Field(() => String, { nullable: true })
  template?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: unknown;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field(() => Boolean, { nullable: true })
  hidden?: boolean | null;
}
