import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { seedDemoData } from "./database/demo-seed";
import { getConnectionToken } from "@nestjs/mongoose";
import { Connection } from "mongoose";

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

  if (useMemoryDb) {
    const connection = app.get<Connection>(getConnectionToken());
    await seedDemoData(connection, logger);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Listening on http://localhost:${port}`);
}

void bootstrap();
