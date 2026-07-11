import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { REVIEW_ACTION_ENUM } from "../../libs/enums/ReviewAction.enum";

export class ReviewTaskDto {
  @ApiProperty({ enum: REVIEW_ACTION_ENUM, example: REVIEW_ACTION_ENUM.ACCEPT })
  @IsEnum(REVIEW_ACTION_ENUM)
  action!: REVIEW_ACTION_ENUM;
}
