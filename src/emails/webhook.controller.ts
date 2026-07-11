import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { EmailsService } from "./emails.service";
import { InboundEmailDto } from "./dto/inbound-email.dto";
import { WebhookTokenGuard } from "./webhook-token.guard";

@Controller("webhooks")
@UseGuards(WebhookTokenGuard)
export class WebhookController {
  constructor(private readonly emailsService: EmailsService) {}

  @Post("email")
  @HttpCode(202)
  receiveEmail(@Body() dto: InboundEmailDto) {
    return this.emailsService.ingest(dto);
  }
}
