import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { WebhookTokenGuard } from "../auth/webhook-token.guard";
import { InboundEmailService } from "./inboundEmail.service";
import { CreateInboundEmailDto } from "./dto/create-inboundEmail.dto";
import { InboundEmailAcceptedDto } from "./dto/inbound-email-response.dto";

@ApiTags("Webhooks")
@ApiSecurity("webhook-token")
@Controller("webhooks")
@UseGuards(WebhookTokenGuard)
export class InboundEmailController {
  constructor(private readonly inboundEmailService: InboundEmailService) {}

  @Post("email")
  @HttpCode(202)
  @ApiOperation({ summary: "Receive an inbound email from the provider and queue it for processing" })
  @ApiResponse({ status: 202, description: "Email accepted", type: InboundEmailAcceptedDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid x-webhook-token header" })
  receiveEmail(@Body() dto: CreateInboundEmailDto): Promise<InboundEmailAcceptedDto> {
    return this.inboundEmailService.ingest(dto);
  }
}
