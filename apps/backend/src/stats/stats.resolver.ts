import { Resolver, Query } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { StatsService } from "./stats.service";
import { DashboardStatsType } from "./stats.types";
import { GqlAuthGuard } from "../auth/auth.guard";

@Resolver()
export class StatsResolver {
  constructor(private statsService: StatsService) {}

  // Every CMS user lands on the dashboard, so this is gated by authentication
  // only — the counters carry no data beyond the size of each collection.
  @Query(() => DashboardStatsType)
  @UseGuards(GqlAuthGuard)
  async dashboardStats() {
    return this.statsService.getDashboardStats();
  }
}
