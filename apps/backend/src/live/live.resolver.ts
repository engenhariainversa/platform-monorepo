import { UnauthorizedException, UseGuards } from "@nestjs/common";
import { Args, Context, Float, ID, Mutation, Query, Resolver, Subscription } from "@nestjs/graphql";
import { prisma } from "@repo/database";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { CurrentUser } from "../common/current-user.decorator";
import { PermissionsService } from "../permissions/permissions.service";
import { badInput, notFound } from "../presentations/presentation-errors";
import { PresentationsService } from "../presentations/presentations.service";
import { LiveSessionService, eventFor, type LiveEventData } from "./live-session.service";
import { GqlLiveControlGuard, GqlOptionalLiveGuard } from "./live.guards";
import { LiveEventObject, LiveStateType } from "./live.types";
import type { SocketRequest } from "./socket-auth.service";

type LiveContext = { req: Partial<SocketRequest> };

/** Runs `cleanup` exactly once when the subscription ends (complete, error or socket close). */
function withCleanup<T>(iterator: AsyncIterableIterator<T>, cleanup: () => void): AsyncIterableIterator<T> {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
  };
  return {
    next: () => iterator.next(),
    return: async (value?: unknown) => {
      finish();
      return iterator.return ? iterator.return(value) : ({ value: undefined, done: true } as IteratorResult<T>);
    },
    throw: async (error?: unknown) => {
      finish();
      return iterator.throw ? iterator.throw(error) : Promise.reject(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

@Resolver()
export class LiveResolver {
  constructor(
    private readonly live: LiveSessionService,
    private readonly presentations: PresentationsService,
    private readonly permissions: PermissionsService,
  ) {}

  /** A CMS session with presentations:update, or the presenter link of this presentation. */
  private async isPresenter(user: AuthenticatedUser | null, presentationId: string): Promise<boolean> {
    if (!user) return false;
    if (user.authKind === "presenterLink") return user.presenterPresentationId === presentationId;
    if (user.authKind === "apiKey") return false;
    return this.permissions.canAccess("presentations", "update", { id: user.role.id, isAdmin: user.role.isAdmin });
  }

  /** Live is public-only (spec L5): anything else looks like "no such deck". */
  private async publicDeck(slug: string): Promise<{ id: string } | null> {
    const deck = await prisma.presentation.findUnique({
      where: { slug },
      select: { id: true, visibility: true, deletedAt: true },
    });
    return deck && deck.visibility === "PUBLIC" && !deck.deletedAt ? { id: deck.id } : null;
  }

  @Query(() => LiveStateType)
  @UseGuards(GqlOptionalLiveGuard)
  async liveState(@Args("slug") slug: string, @CurrentUser() user: AuthenticatedUser | null) {
    const deck = await this.publicDeck(slug);
    if (!deck) return this.live.state("", false);
    return this.live.state(deck.id, await this.isPresenter(user, deck.id));
  }

  @Subscription(() => LiveEventObject, {
    filter: (payload: LiveEventData, _variables: unknown, context: LiveContext) =>
      eventFor(payload, context.req.livePresenter === true) !== null,
    resolve: (payload: LiveEventData, _args: unknown, context: LiveContext) =>
      eventFor(payload, context.req.livePresenter === true),
  })
  @UseGuards(GqlOptionalLiveGuard)
  async liveEvents(
    @Args("slug") slug: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Context() context: LiveContext,
  ) {
    const deck = await this.publicDeck(slug);
    if (!deck) throw new UnauthorizedException("Apresentação privada");
    // The context object lives as long as the subscription: filter/resolve read it.
    context.req.livePresenter = await this.isPresenter(user, deck.id);
    const iterator = this.live.events(deck.id);
    const session = context.req.socketSession;
    // Presenters watch the same events but are not audience.
    if (context.req.livePresenter || !session) return iterator;

    this.live.addViewer(deck.id, session.viewerId, session.socketId);
    return withCleanup(iterator, () => this.live.removeViewer(deck.id, session.viewerId, session.socketId));
  }

  @Mutation(() => LiveStateType)
  @UseGuards(GqlLiveControlGuard)
  async startLive(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("slideId", { type: () => ID }) slideId: string,
  ) {
    const presentation = await this.presentations.getById(presentationId);
    if (!presentation || presentation.deletedAt) throw notFound("Apresentação não encontrada");
    if (presentation.visibility !== "PUBLIC") throw badInput("Torne a apresentação pública para transmitir");
    if (!presentation.slides.some((slide) => slide.id === slideId)) {
      throw badInput("O slide não pertence a esta apresentação");
    }
    this.live.start({ presentationId, slug: presentation.slug, slideId });
    return this.live.state(presentationId, true);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlLiveControlGuard)
  stopLive(@Args("presentationId", { type: () => ID }) presentationId: string) {
    this.live.stop(presentationId);
    return true;
  }

  /** false when there is no session: the presenter's player then re-sends startLive. */
  @Mutation(() => Boolean)
  @UseGuards(GqlLiveControlGuard)
  async setLiveSlide(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("slideId", { type: () => ID }) slideId: string,
  ) {
    // Looked up fresh: a slide added after startLive is followable too.
    const slide = await prisma.slide.findFirst({ where: { id: slideId, presentationId }, select: { id: true } });
    if (!slide) throw badInput("O slide não pertence a esta apresentação");
    return this.live.setSlide(presentationId, slideId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlLiveControlGuard)
  movePointer(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("x", { type: () => Float }) x: number,
    @Args("y", { type: () => Float }) y: number,
    @Args("visible") visible: boolean,
  ) {
    return this.live.movePointer(presentationId, x, y, visible);
  }

  @Mutation(() => LiveStateType)
  @UseGuards(GqlLiveControlGuard)
  setLiveOptions(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("showViewerCount", { type: () => Boolean, nullable: true }) showViewerCount?: boolean | null,
    @Args("showReactionsOnScreen", { type: () => Boolean, nullable: true }) showReactionsOnScreen?: boolean | null,
  ) {
    this.live.setOptions(presentationId, { showViewerCount, showReactionsOnScreen });
    return this.live.state(presentationId, true);
  }
}
