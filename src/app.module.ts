import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { CompaniesModule } from "./companies/companies.module";
import { UsersModule } from "./users/users.module";
import { EmailsModule } from "./emails/emails.module";
import { TasksModule } from "./tasks/tasks.module";
import { LlmModule } from "./llm/llm.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI") ?? "mongodb://127.0.0.1:27017/email-task-automation",
      }),
    }),
    CompaniesModule,
    UsersModule,
    LlmModule,
    TasksModule,
    EmailsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
