import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { InboundEmail, InboundEmailSchema } from "./inbound-email.schema";
import { EmailsService } from "./emails.service";
import { WebhookController } from "./webhook.controller";
import { UsersModule } from "../users/users.module";
import { LlmModule } from "../llm/llm.module";
import { TasksModule } from "../tasks/tasks.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: InboundEmail.name, schema: InboundEmailSchema }]),
    UsersModule,
    LlmModule,
    TasksModule,
  ],
  controllers: [WebhookController],
  providers: [EmailsService],
  exports: [EmailsService],
})
export class EmailsModule {}
