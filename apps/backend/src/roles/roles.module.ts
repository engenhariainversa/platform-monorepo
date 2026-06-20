import { Module, Global } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { RolesResolver } from "./roles.resolver";

@Global()
@Module({
  providers: [RolesService, RolesResolver],
  exports: [RolesService],
})
export class RolesModule {}
