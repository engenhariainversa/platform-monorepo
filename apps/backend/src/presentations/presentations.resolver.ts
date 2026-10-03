import { UseGuards } from "@nestjs/common";
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from "@nestjs/graphql";
import type { Slide } from "@repo/database";
import { SLIDE_TEMPLATES, SLIDE_TEMPLATE_KEYS, slideTemplateJsonSchema } from "@repo/slides";
import { GqlAuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { GqlJwtOrApiKeyGuard, GqlOptionalAuthGuard } from "../auth/jwt-or-api-key.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { Resource } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { PermissionsService } from "../permissions/permissions.service";
import {
  PresentationsService,
  type CreatePresentationData,
  type PresentationWithSlides,
  type UpdatePresentationData,
} from "./presentations.service";
import {
  CreatePresentationInput,
  PresentationType,
  SlideInput,
  SlideTemplateInfoType,
  SlideType,
  UpdatePresentationInput,
  UpdateSlideInput,
} from "./presentations.types";
import { SlidesService } from "./slides.service";

@Resolver(() => PresentationType)
export class PresentationsResolver {
  constructor(
    private readonly presentationsService: PresentationsService,
    private readonly slidesService: SlidesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @ResolveField(() => Int)
  slideCount(@Parent() p: PresentationWithSlides): number {
    return p.slides.length;
  }

  // ── Reads ─────────────────────────────────────────

  @Query(() => [PresentationType])
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "read")
  presentations(@Args("trash", { type: () => Boolean, nullable: true, defaultValue: false }) trash: boolean) {
    return this.presentationsService.list(trash);
  }

  @Query(() => PresentationType, { nullable: true })
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "read")
  presentation(@Args("id", { type: () => ID }) id: string) {
    return this.presentationsService.getById(id);
  }

  /** Public for PUBLIC decks; everything else needs a session or key with presentations:read. */
  @Query(() => PresentationType, { nullable: true })
  @UseGuards(GqlOptionalAuthGuard)
  async presentationBySlug(
    @Args("slug") slug: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const canRead = user
      ? await this.permissionsService.canAccess("presentations", "read", { id: user.role.id, isAdmin: user.role.isAdmin })
      : false;
    return this.presentationsService.getBySlug(slug, user ? { user, canRead } : null);
  }

  @Query(() => [SlideTemplateInfoType])
  slideTemplates(): SlideTemplateInfoType[] {
    return SLIDE_TEMPLATE_KEYS.map((key) => {
      const def = SLIDE_TEMPLATES[key];
      return {
        key,
        label: def.label,
        description: def.description,
        jsonSchema: slideTemplateJsonSchema(key),
        example: def.example as Record<string, unknown>,
      };
    });
  }

  // ── Presentation writes (session or API key) ─────

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "create")
  createPresentation(@Args("input") input: CreatePresentationInput, @CurrentUser() user: AuthenticatedUser) {
    // The GraphQL enum and @repo/slides' string union carry the same values.
    return this.presentationsService.create(input as CreatePresentationData, user.id);
  }

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  updatePresentation(@Args("id", { type: () => ID }) id: string, @Args("input") input: UpdatePresentationInput) {
    return this.presentationsService.update(id, input as UpdatePresentationData);
  }

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "create")
  duplicatePresentation(@Args("id", { type: () => ID }) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.presentationsService.duplicate(id, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "delete")
  deletePresentation(@Args("id", { type: () => ID }) id: string) {
    return this.presentationsService.softDelete(id);
  }

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "delete")
  restorePresentation(@Args("id", { type: () => ID }) id: string) {
    return this.presentationsService.restore(id);
  }

  /** JWT only: an API key can trash, never destroy. */
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("presentations", "delete")
  purgePresentation(@Args("id", { type: () => ID }) id: string) {
    return this.presentationsService.purge(id);
  }

  // ── Slide writes ──────────────────────────────────

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  async replaceSlides(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("slides", { type: () => [SlideInput] }) slides: SlideInput[],
  ) {
    await this.slidesService.replaceSlides(presentationId, slides);
    return this.presentationsService.getById(presentationId);
  }

  @Mutation(() => SlideType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  createSlide(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("input") input: SlideInput,
    @Args("position", { type: () => Int, nullable: true }) position?: number | null,
  ): Promise<Slide> {
    return this.slidesService.createSlide(presentationId, input, position);
  }

  @Mutation(() => SlideType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  updateSlide(@Args("id", { type: () => ID }) id: string, @Args("input") input: UpdateSlideInput): Promise<Slide> {
    return this.slidesService.updateSlide(id, {
      template: input.template ?? undefined,
      content: input.content,
      notes: input.notes ?? undefined,
      hidden: input.hidden ?? undefined,
    });
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  deleteSlide(@Args("id", { type: () => ID }) id: string) {
    return this.slidesService.deleteSlide(id);
  }

  @Mutation(() => [SlideType])
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  reorderSlides(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("ids", { type: () => [ID] }) ids: string[],
  ): Promise<Slide[]> {
    return this.slidesService.reorderSlides(presentationId, ids);
  }
}
