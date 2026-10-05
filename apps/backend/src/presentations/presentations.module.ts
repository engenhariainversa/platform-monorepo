import { Module } from "@nestjs/common";
import { PresentationsResolver } from "./presentations.resolver";
import { PresentationsService } from "./presentations.service";
import { SlidesService } from "./slides.service";

@Module({
  providers: [PresentationsService, SlidesService, PresentationsResolver],
  exports: [PresentationsService, SlidesService],
})
export class PresentationsModule {}
