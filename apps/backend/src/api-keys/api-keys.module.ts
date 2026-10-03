import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ApiKeyStrategy } from "../auth/api-key.strategy";
import { ApiKeysResolver } from "./api-keys.resolver";
import { ApiKeysService } from "./api-keys.service";

@Module({
  imports: [PassportModule],
  providers: [ApiKeysService, ApiKeysResolver, ApiKeyStrategy],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
