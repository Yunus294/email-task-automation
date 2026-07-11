import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { WebhookTokenGuard } from "../auth/webhook-token.guard";
import { InboundEmailService } from "./inboundEmail.service";
import { CreateInboundEmailDto } from "./dto/create-inboundEmail.dto";

@ApiTags("Webhooks")
@ApiSecurity("webhook-token")
@Controller("webhooks")
@UseGuards(WebhookTokenGuard)
export class InboundEmailController {
  constructor(private readonly inboundEmailService: InboundEmailService) {}

  @Post("email")
  @HttpCode(202)
  receiveEmail(@Body() dto: CreateInboundEmailDto) {
    return this.inboundEmailService.ingest(dto);
  }
}
