import { Module, Global } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { PermissionsResolver } from "./permissions.resolver";

@Global()
@Module({
  providers: [PermissionsService, PermissionsResolver],
  exports: [PermissionsService],
})
export class PermissionsModule {}
