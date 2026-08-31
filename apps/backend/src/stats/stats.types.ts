import { Field, Int, ObjectType } from "@nestjs/graphql";

// Counters rendered on the CMS dashboard. Grouped into a single query so the
// dashboard does not have to fetch whole collections (and hold read permission
// on each of them) just to show their size.
@ObjectType()
export class DashboardStatsType {
  @Field(() => Int)
  users!: number;

  @Field(() => Int)
  episodes!: number;

  @Field(() => Int)
  lives!: number;
}
