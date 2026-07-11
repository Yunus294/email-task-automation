import { ApiProperty } from "@nestjs/swagger";
import { INBOUND_EMAIL_STATUS_ENUM } from "../../libs/enums/InboundEmailStatus.enum";

export class InboundEmailAcceptedDto {
  @ApiProperty({ example: "6a52217616c2680b4ff69d23" })
  id!: string;

  @ApiProperty({ enum: INBOUND_EMAIL_STATUS_ENUM, example: INBOUND_EMAIL_STATUS_ENUM.RECEIVED })
  status!: INBOUND_EMAIL_STATUS_ENUM;

  @ApiProperty({ example: false, description: "true when this messageId was already received" })
  duplicate!: boolean;
}
