import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { ContentService } from "./content.service";
import {
  LiveType,
  EpisodeType,
  UpsertLiveInput,
  CreateEpisodeInput,
  UpdateEpisodeInput,
} from "./content.types";
import { GqlAuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { Role } from "../users/users.types";

@Resolver()
export class ContentResolver {
  constructor(private contentService: ContentService) {}

  // ── Live ──────────────────────────────────────────

  @Query(() => LiveType, { nullable: true })
  async live() {
    return this.contentService.getLive();
  }

  @Mutation(() => LiveType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async upsertLive(@Args("input") input: UpsertLiveInput) {
    return this.contentService.upsertLive(input);
  }

  // ── Episodes ──────────────────────────────────────

  @Query(() => [EpisodeType])
  async episodes() {
    return this.contentService.getEpisodes();
  }

  @Mutation(() => EpisodeType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async createEpisode(@Args("input") input: CreateEpisodeInput) {
    return this.contentService.createEpisode(input);
  }

  @Mutation(() => EpisodeType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async updateEpisode(
    @Args("id") id: string,
    @Args("input") input: UpdateEpisodeInput,
  ) {
    return this.contentService.updateEpisode(id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async deleteEpisode(@Args("id") id: string) {
    return this.contentService.deleteEpisode(id);
  }

  @Mutation(() => [EpisodeType])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async reorderEpisodes(@Args("ids", { type: () => [String] }) ids: string[]) {
    return this.contentService.reorderEpisodes(ids);
  }
}
