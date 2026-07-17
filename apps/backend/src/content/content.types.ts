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
  buttonTextBefore!: string;

  @Field()
  buttonUrl!: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field()
  isLive!: boolean;

  @Field()
  isVisible!: boolean;

  @Field()
  viewersCount!: string;

  @Field({ nullable: true })
  occursAt?: Date;

  @Field({ nullable: true })
  occursAtTimezone?: string;

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
  buttonTextBefore!: string;

  @Field()
  buttonUrl!: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field()
  isLive!: boolean;

  @Field()
  isVisible!: boolean;

  @Field()
  viewersCount!: string;

  @Field({ nullable: true })
  occursAt?: Date;

  @Field({ nullable: true })
  occursAtTimezone?: string;
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

// ── Hero section (singleton) ─────────────────────────

@ObjectType()
export class HeroSectionType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  subtitle!: string;

  @Field()
  buttonText!: string;

  @Field()
  buttonUrl!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@InputType()
export class UpsertHeroSectionInput {
  @Field()
  title!: string;

  @Field()
  subtitle!: string;

  @Field()
  buttonText!: string;

  @Field()
  buttonUrl!: string;
}

// ── About section (singleton) ────────────────────────

@ObjectType()
export class AboutSectionType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field()
  stat1Value!: string;

  @Field()
  stat1Label!: string;

  @Field()
  stat2Value!: string;

  @Field()
  stat2Label!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@InputType()
export class UpsertAboutSectionInput {
  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field()
  stat1Value!: string;

  @Field()
  stat1Label!: string;

  @Field()
  stat2Value!: string;

  @Field()
  stat2Label!: string;
}

// ── Episodes button (singleton) ──────────────────────

@ObjectType()
export class EpisodesButtonType {
  @Field(() => ID)
  id!: string;

  @Field()
  text!: string;

  @Field()
  url!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@InputType()
export class UpsertEpisodesButtonInput {
  @Field()
  text!: string;

  @Field()
  url!: string;
}
