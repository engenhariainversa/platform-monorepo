import { Module } from "@nestjs/common";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { SocketAuthService } from "./socket-auth.service";
import { SocketRegistry } from "./socket-registry";

@Module({
  imports: [AuthModule, ApiKeysModule],
  providers: [SocketRegistry, SocketAuthService],
  exports: [SocketRegistry, SocketAuthService],
})
export class LiveModule {}
