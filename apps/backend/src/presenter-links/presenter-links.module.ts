import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { GqlPresenterLinkGuard } from "../auth/presenter-link.guard";
import { PresenterLinkStrategy } from "../auth/presenter-link.strategy";
import { PresentationsModule } from "../presentations/presentations.module";
import { PresenterLinksResolver } from "./presenter-links.resolver";
import { PresenterLinksService } from "./presenter-links.service";

@Module({
  imports: [PassportModule, PresentationsModule],
  providers: [PresenterLinksService, PresenterLinkStrategy, PresenterLinksResolver, GqlPresenterLinkGuard],
  exports: [PresenterLinksService],
})
export class PresenterLinksModule {}
