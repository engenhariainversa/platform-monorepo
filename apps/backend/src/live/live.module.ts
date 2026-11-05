import { Module, type OnModuleInit } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { PresentationsModule } from "../presentations/presentations.module";
import { PresentationsService } from "../presentations/presentations.service";
import { PresenterLinksModule } from "../presenter-links/presenter-links.module";
import { LINK_GONE, PresenterLinksService } from "../presenter-links/presenter-links.service";
import { LiveSessionService } from "./live-session.service";
import { GqlLiveControlGuard, GqlOptionalLiveGuard } from "./live.guards";
import { LiveResolver } from "./live.resolver";
import { SocketAuthService } from "./socket-auth.service";
import { CLOSE_FORBIDDEN, SocketRegistry } from "./socket-registry";

@Module({
  imports: [PassportModule, AuthModule, ApiKeysModule, PresenterLinksModule, PresentationsModule],
  providers: [
    SocketRegistry,
    SocketAuthService,
    LiveSessionService,
    LiveResolver,
    GqlLiveControlGuard,
    GqlOptionalLiveGuard,
  ],
  exports: [SocketRegistry, SocketAuthService, LiveSessionService],
})
export class LiveModule implements OnModuleInit {
  constructor(
    private readonly presentations: PresentationsService,
    private readonly live: LiveSessionService,
    private readonly registry: SocketRegistry,
    private readonly presenterLinks: PresenterLinksService,
  ) {}

  onModuleInit(): void {
    // Turning a live presentation private, or trashing it, ends the session.
    this.presentations.onUnpublished((presentationId) => {
      this.live.stop(presentationId);
      void this.closeLinksOfTrashedDeck(presentationId);
    });
    // Revocation takes effect on open sockets immediately (spec §3.3).
    this.presenterLinks.onRevoked((linkId) =>
      this.registry.closeWhere((entry) => entry.presenterLinkId === linkId, CLOSE_FORBIDDEN, LINK_GONE),
    );
    // Belt and braces: a socket that dies without completing its subscription.
    this.registry.onRemove((socketId) => this.live.dropSocket(socketId));
  }

  /**
   * A trashed deck invalidates its presenter links without revoking them, so no
   * onRevoked fires. Turning a deck private keeps them valid, hence the lookup.
   * Purge requires the trash first, so it is covered here too.
   */
  private async closeLinksOfTrashedDeck(presentationId: string): Promise<void> {
    try {
      const deck = await this.presentations.getById(presentationId);
      if (deck && !deck.deletedAt) return;
      this.registry.closeWhere(
        (entry) => entry.presenterPresentationId === presentationId,
        CLOSE_FORBIDDEN,
        LINK_GONE,
      );
    } catch {
      // Best effort: each new operation re-authenticates and fails anyway.
    }
  }
}
