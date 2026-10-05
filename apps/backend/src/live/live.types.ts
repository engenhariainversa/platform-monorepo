import { Field, Float, ID, Int, ObjectType, registerEnumType } from "@nestjs/graphql";

export enum LiveEventTypeEnum {
  STARTED = "STARTED",
  SLIDE = "SLIDE",
  POINTER = "POINTER",
  VIEWERS = "VIEWERS",
  REACTIONS = "REACTIONS",
  OPTIONS = "OPTIONS",
  ENDED = "ENDED",
}
registerEnumType(LiveEventTypeEnum, { name: "LiveEventType" });

export enum ReactionKindEnum {
  CLAP = "CLAP",
  FIRE = "FIRE",
  MIND_BLOWN = "MIND_BLOWN",
  LAUGH = "LAUGH",
  HEART = "HEART",
  THINKING = "THINKING",
}
registerEnumType(ReactionKindEnum, { name: "ReactionKind" });

@ObjectType("LivePointer")
export class LivePointerType {
  @Field(() => Float, { description: "0..1 across the 1920×1080 canvas" })
  x!: number;

  @Field(() => Float)
  y!: number;

  @Field()
  visible!: boolean;
}

@ObjectType("ReactionCount")
export class ReactionCountType {
  @Field(() => ReactionKindEnum)
  kind!: ReactionKindEnum;

  @Field(() => Int)
  count!: number;
}

@ObjectType("LiveState")
export class LiveStateType {
  @Field()
  isLive!: boolean;

  @Field(() => Date, { nullable: true })
  startedAt!: Date | null;

  @Field(() => ID, { nullable: true })
  slideId!: string | null;

  @Field()
  showViewerCount!: boolean;

  @Field()
  showReactionsOnScreen!: boolean;

  @Field(() => Int, { nullable: true, description: "null for the audience while the counter is hidden" })
  viewerCount!: number | null;

  @Field(() => Int, { nullable: true, description: "Presenters only" })
  peakViewers!: number | null;

  @Field(() => [ReactionCountType], { nullable: true, description: "Presenters only" })
  reactionTotals!: ReactionCountType[] | null;
}

@ObjectType("LiveEvent")
export class LiveEventObject {
  @Field(() => LiveEventTypeEnum)
  type!: LiveEventTypeEnum;

  @Field(() => ID, { nullable: true, description: "STARTED, SLIDE" })
  slideId?: string;

  @Field(() => LivePointerType, { nullable: true, description: "POINTER" })
  pointer?: LivePointerType;

  @Field(() => Int, { nullable: true, description: "VIEWERS" })
  viewerCount?: number;

  @Field(() => Int, { nullable: true, description: "VIEWERS, presenters only" })
  peakViewers?: number;

  @Field(() => [ReactionCountType], { nullable: true, description: "REACTIONS" })
  reactions?: ReactionCountType[];

  @Field(() => Boolean, { nullable: true, description: "OPTIONS" })
  showViewerCount?: boolean;

  @Field(() => Boolean, { nullable: true, description: "OPTIONS" })
  showReactionsOnScreen?: boolean;
}
