import { Module, type OnModuleInit } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { PresentationsModule } from "../presentations/presentations.module";
import { PresentationsService } from "../presentations/presentations.service";
import { PresenterLinksModule } from "../presenter-links/presenter-links.module";
import { LiveSessionService } from "./live-session.service";
import { GqlLiveControlGuard, GqlOptionalLiveGuard } from "./live.guards";
import { LiveResolver } from "./live.resolver";
import { SocketAuthService } from "./socket-auth.service";
import { SocketRegistry } from "./socket-registry";

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
  ) {}

  onModuleInit(): void {
    // Turning a live presentation private, or trashing it, ends the session.
    this.presentations.onUnpublished((presentationId) => this.live.stop(presentationId));
    // Belt and braces: a socket that dies without completing its subscription.
    this.registry.onRemove((socketId) => this.live.dropSocket(socketId));
  }
}
