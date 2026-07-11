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

export class InboundEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  messageId: string;

  @IsEmail()
  from: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  to: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  html?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
