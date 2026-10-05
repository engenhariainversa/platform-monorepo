import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { AppResolver } from "./app.resolver";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { PresentationsModule } from "./presentations/presentations.module";
import { ContentModule } from "./content/content.module";
import { UploadModule } from "./upload/upload.module";
import { RolesModule } from "./roles/roles.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { StatsModule } from "./stats/stats.module";
import { LiveModule } from "./live/live.module";
import { formatSocketResult, SocketAuthService, type SocketContext } from "./live/socket-auth.service";

import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../../.env",
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [LiveModule],
      inject: [SocketAuthService],
      useFactory: (socketAuth: SocketAuthService) => ({
        autoSchemaFile: join(process.cwd(), "src/schema.gql"),
        playground: false,
        plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
        subscriptions: {
          "graphql-ws": {
            path: "/graphql",
            onConnect: (ctx) => socketAuth.onConnect(ctx as unknown as SocketContext),
            onDisconnect: (ctx) => socketAuth.onDisconnect(ctx as unknown as SocketContext),
            onNext: (_ctx, _id, _payload, _args, result) => formatSocketResult(result),
          },
        },
        // HTTP operations arrive as { req, res }; socket operations arrive as the
        // graphql-ws context, recognised by the session stored in onConnect.
        context: (ctx: { req?: unknown; res?: unknown; extra?: { session?: unknown } }) =>
          ctx.extra?.session
            ? socketAuth.context(ctx as unknown as SocketContext)
            : { req: ctx.req, res: ctx.res },
      }),
    }),
    RolesModule,
    PermissionsModule,
    UsersModule,
    AuthModule,
    ApiKeysModule,
    PresentationsModule,
    LiveModule,
    ContentModule,
    UploadModule,
    StatsModule,
  ],
  providers: [AppResolver],
})
export class AppModule {}
