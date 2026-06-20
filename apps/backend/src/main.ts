import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 4050;
  await app.listen(port);
  console.log(
    `🚀 NestJS Backend GraphQL API running at http://localhost:${port}/graphql`,
  );
}
bootstrap();
