import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateInboundEmailDto {
  @ApiProperty({ example: "msg-123@provider" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  messageId!: string;

  @ApiProperty({ example: "client@corp.com" })
  @IsEmail()
  from!: string;

  @ApiProperty({ example: ["sara@acme.uz"], isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  to!: string[];

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200000)
  html?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
