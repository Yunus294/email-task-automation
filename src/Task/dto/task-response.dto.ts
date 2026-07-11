import { ApiProperty } from "@nestjs/swagger";
import { TASK_STATUS_ENUM } from "../../libs/enums/TaskStatus.enum";

export class TaskSourceResponseDto {
  @ApiProperty({ example: "6a52217616c2680b4ff69d23" })
  emailId!: string;

  @ApiProperty({ example: "msg-001@provider" })
  messageId!: string;

  @ApiProperty({ example: "client@corp.com" })
  from!: string;

  @ApiProperty({ example: "Please send the invoice by 2026-07-20" })
  subject!: string;
}

export class TaskResponseDto {
  @ApiProperty({ example: "6a52217616c2680b4ff69d28" })
  id!: string;

  @ApiProperty({ example: "6a52215916c2680b4ff69d12" })
  companyId!: string;

  @ApiProperty({ example: "Please send the invoice by 2026-07-20" })
  title!: string;

  @ApiProperty({ nullable: true, example: "Can you prepare and send the invoice?" })
  description!: string | null;

  @ApiProperty({ type: String, format: "date-time", nullable: true, example: "2026-07-20T00:00:00.000Z" })
  dueDate!: Date | null;

  @ApiProperty({ nullable: true, example: null })
  assigneeId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  assigneeEmail!: string | null;

  @ApiProperty({ enum: TASK_STATUS_ENUM, example: TASK_STATUS_ENUM.PENDING_REVIEW })
  status!: TASK_STATUS_ENUM;

  @ApiProperty({ type: TaskSourceResponseDto, nullable: true })
  source!: TaskSourceResponseDto | null;

  @ApiProperty({ nullable: true, example: 0.5 })
  llmConfidence!: number | null;

  @ApiProperty({ type: String, format: "date-time", nullable: true, example: null })
  reviewedAt!: Date | null;

  @ApiProperty({ type: String, format: "date-time", example: "2026-07-11T10:56:54.786Z" })
  createdAt!: Date;

  @ApiProperty({ type: String, format: "date-time", example: "2026-07-11T10:56:54.786Z" })
  updatedAt!: Date;
}

export class TaskPageResponseDto {
  @ApiProperty({ type: TaskResponseDto, isArray: true })
  items!: TaskResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  size!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}
