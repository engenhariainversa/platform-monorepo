import { Field, ObjectType, InputType, Int, ID } from "@nestjs/graphql";

// ── Live ─────────────────────────────────────────────

@ObjectType()
export class LiveType {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  buttonText!: string;

  @Field()
  buttonUrl!: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field()
  isLive!: boolean;

  @Field()
  viewersCount!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@InputType()
export class UpsertLiveInput {
  @Field()
  label!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  buttonText!: string;

  @Field()
  buttonUrl!: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field()
  isLive!: boolean;

  @Field()
  viewersCount!: string;
}

// ── Episode ──────────────────────────────────────────

@ObjectType()
export class EpisodeType {
  @Field(() => ID)
  id!: string;

  @Field()
  module!: string;

  @Field()
  title!: string;

  @Field()
  duration!: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field(() => Int)
  order!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@InputType()
export class CreateEpisodeInput {
  @Field()
  module!: string;

  @Field()
  title!: string;

  @Field()
  duration!: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field(() => Int, { nullable: true })
  order?: number;
}

@InputType()
export class UpdateEpisodeInput {
  @Field({ nullable: true })
  module?: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  duration?: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field(() => Int, { nullable: true })
  order?: number;
}
