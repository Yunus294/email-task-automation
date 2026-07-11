import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class PagePaginationDto {
  @ApiPropertyOptional({
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  size?: number = 20;
}
