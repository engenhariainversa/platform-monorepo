import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { AppResolver } from "./app.resolver";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { ContentModule } from "./content/content.module";
import { UploadModule } from "./upload/upload.module";
import { RolesModule } from "./roles/roles.module";
import { PermissionsModule } from "./permissions/permissions.module";

import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../../.env",
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "src/schema.gql"),
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
    }),
    RolesModule,
    PermissionsModule,
    UsersModule,
    AuthModule,
    ContentModule,
    UploadModule,
  ],
  providers: [AppResolver],
})
export class AppModule {}
