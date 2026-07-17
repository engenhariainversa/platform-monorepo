import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { ContentService } from "./content.service";
import {
  LiveType,
  EpisodeType,
  EpisodesButtonType,
  HeroSectionType,
  AboutSectionType,
  UpsertLiveInput,
  CreateEpisodeInput,
  UpdateEpisodeInput,
  UpsertEpisodesButtonInput,
  UpsertHeroSectionInput,
  UpsertAboutSectionInput,
} from "./content.types";
import { GqlAuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Resource } from "../common/roles.decorator";

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
  @Resource("live", "update")
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
  @Resource("episodes", "create")
  async createEpisode(@Args("input") input: CreateEpisodeInput) {
    return this.contentService.createEpisode(input);
  }

  @Mutation(() => EpisodeType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("episodes", "update")
  async updateEpisode(
    @Args("id") id: string,
    @Args("input") input: UpdateEpisodeInput,
  ) {
    return this.contentService.updateEpisode(id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("episodes", "delete")
  async deleteEpisode(@Args("id") id: string) {
    return this.contentService.deleteEpisode(id);
  }

  @Mutation(() => [EpisodeType])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("episodes", "update")
  async reorderEpisodes(@Args("ids", { type: () => [String] }) ids: string[]) {
    return this.contentService.reorderEpisodes(ids);
  }

  // ── Hero section ──────────────────────────────────

  @Query(() => HeroSectionType, { nullable: true })
  async heroSection() {
    return this.contentService.getHeroSection();
  }

  @Mutation(() => HeroSectionType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("hero", "update")
  async upsertHeroSection(@Args("input") input: UpsertHeroSectionInput) {
    return this.contentService.upsertHeroSection(input);
  }

  // ── About section ─────────────────────────────────

  @Query(() => AboutSectionType, { nullable: true })
  async aboutSection() {
    return this.contentService.getAboutSection();
  }

  @Mutation(() => AboutSectionType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("about", "update")
  async upsertAboutSection(@Args("input") input: UpsertAboutSectionInput) {
    return this.contentService.upsertAboutSection(input);
  }

  // ── Episodes button ───────────────────────────────

  @Query(() => EpisodesButtonType, { nullable: true })
  async episodesButton() {
    return this.contentService.getEpisodesButton();
  }

  @Mutation(() => EpisodesButtonType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("episodes", "update")
  async upsertEpisodesButton(@Args("input") input: UpsertEpisodesButtonInput) {
    return this.contentService.upsertEpisodesButton(input);
  }
}
