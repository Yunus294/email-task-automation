import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { PagePaginationDto } from "../../libs/pagination/page-pagination.dto";
import { TASK_STATUS_ENUM } from "../../libs/enums/TaskStatus.enum";

export class TaskFilterDto extends PagePaginationDto {
  @ApiPropertyOptional({ enum: TASK_STATUS_ENUM })
  @IsOptional()
  @IsEnum(TASK_STATUS_ENUM)
  status?: TASK_STATUS_ENUM;
}
