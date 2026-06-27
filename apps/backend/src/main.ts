import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigins = process.env.CORS_ORIGINS
    ?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  const port = process.env.PORT || 4050;
  await app.listen(port);
  console.log(
    `🚀 NestJS Backend GraphQL API running at http://localhost:${port}/graphql`,
  );
}
bootstrap();
