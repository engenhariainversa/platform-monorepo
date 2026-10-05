import { UnauthorizedException, UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { GqlAuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { GqlPresenterLinkGuard } from "../auth/presenter-link.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { Resource } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { PresentationsService } from "../presentations/presentations.service";
import { PresentationType } from "../presentations/presentations.types";
import { LINK_GONE, PresenterLinksService } from "./presenter-links.service";
import { CreatedPresenterLinkType, PresenterLinkExpiry, PresenterLinkType } from "./presenter-links.types";

@Resolver()
export class PresenterLinksResolver {
  // Not `presenterLinks`: that name is taken by the query method below (TS2300).
  constructor(
    private readonly presenterLinksService: PresenterLinksService,
    private readonly presentationsService: PresentationsService,
  ) {}

  // ── Management: CMS session only (GqlAuthGuard = JWT) ──

  @Query(() => [PresenterLinkType])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("presentations", "update")
  presenterLinks(@Args("presentationId", { type: () => ID }) presentationId: string) {
    return this.presenterLinksService.list(presentationId);
  }

  @Mutation(() => CreatedPresenterLinkType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("presentations", "update")
  async createPresenterLink(
    @CurrentUser() user: AuthenticatedUser,
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("name") name: string,
    @Args("expiresIn", { type: () => PresenterLinkExpiry }) expiresIn: PresenterLinkExpiry,
  ) {
    const { presenterLink, url } = await this.presenterLinksService.create(presentationId, user.id, name, expiresIn);
    return { presenterLink, url };
  }

  @Mutation(() => PresenterLinkType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("presentations", "update")
  revokePresenterLink(@Args("id", { type: () => ID }) id: string) {
    return this.presenterLinksService.revoke(id);
  }

  // ── The link itself ────────────────────────────────────

  /** The one presentation the link is scoped to, in full (notes and hidden slides). */
  @Query(() => PresentationType)
  @UseGuards(GqlPresenterLinkGuard)
  async presentationForPresenter(@CurrentUser() user: AuthenticatedUser) {
    const presentation = await this.presentationsService.getById(user.presenterPresentationId as string);
    if (!presentation || presentation.deletedAt) throw new UnauthorizedException(LINK_GONE);
    return presentation;
  }
}
