import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { CompanyEntity, CompanySchema } from "./Company/company.entity";
import { UserEntity, UserSchema } from "./User/user.entity";
import { UserService } from "./User/user.service";
import { TaskEntity, TaskSchema } from "./Task/task.entity";
import { TaskService } from "./Task/task.service";
import { TaskController } from "./Task/task.controller";
import { InboundEmailEntity, InboundEmailSchema } from "./InboundEmail/inboundEmail.entity";
import { InboundEmailService } from "./InboundEmail/inboundEmail.service";
import { InboundEmailController } from "./InboundEmail/inboundEmail.controller";
import { LlmService } from "./Llm/llm.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI") ?? "mongodb://127.0.0.1:27017/email-task-automation",
      }),
    }),

    MongooseModule.forFeature([
      { name: CompanyEntity.name, schema: CompanySchema },
      { name: UserEntity.name, schema: UserSchema },
      { name: TaskEntity.name, schema: TaskSchema },
      { name: InboundEmailEntity.name, schema: InboundEmailSchema },
    ]),
  ],
  controllers: [ TaskController, InboundEmailController],
  providers: [UserService, TaskService, InboundEmailService, LlmService],
})
export class AppModule {}
