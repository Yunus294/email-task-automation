import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { getConnectionToken } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { AppModule } from "./app.module";
import { seedDemoData } from "./database/demo-seed";

async function resolveMongoUri(): Promise<string> {
  if (process.env.USE_MEMORY_DB === "true") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    return mongod.getUri("email-task-automation");
  }
  return process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/email-task-automation";
}

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const useMemoryDb = process.env.USE_MEMORY_DB === "true";

  process.env.MONGODB_URI = await resolveMongoUri();
  if (useMemoryDb) {
    logger.warn(`USE_MEMORY_DB is on, data will be lost on restart (${process.env.MONGODB_URI})`);
  }

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Email Task Automation")
    .setVersion("1.0")
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "api-key")
    .addApiKey({ type: "apiKey", name: "x-webhook-token", in: "header" }, "webhook-token")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  if (useMemoryDb) {
    const connection = app.get<Connection>(getConnectionToken());
    await seedDemoData(connection, logger);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Listening on http://localhost:${port}`);
}

void bootstrap();
