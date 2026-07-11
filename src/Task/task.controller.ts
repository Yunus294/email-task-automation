import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { CurrentCompany } from "../auth/current-company.decorator";
import { LeanCompany } from "../Company/company.entity";
import { TaskService } from "./task.service";
import { TaskMapper } from "./task.mapper";
import { TaskFilterDto } from "./dto/get-task.dto";
import { ReviewTaskDto } from "./dto/review-task.dto";
import { TaskPageResponseDto, TaskResponseDto } from "./dto/task-response.dto";

@ApiTags("Tasks")
@ApiSecurity("api-key")
@ApiUnauthorizedResponse({ description: "Missing or invalid x-api-key header" })
@Controller("tasks")
@UseGuards(ApiKeyGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @ApiOperation({ summary: "List the company's tasks, paginated and optionally filtered by status" })
  @ApiOkResponse({ type: TaskPageResponseDto })
  async findAll(@CurrentCompany() company: LeanCompany, @Query() dto: TaskFilterDto) {
    return TaskMapper.toPage(await this.taskService.findAll(company._id, dto));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single task owned by the company" })
  @ApiParam({ name: "id", example: "6a52217616c2680b4ff69d28" })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: "Task not found for this company" })
  async findOne(@CurrentCompany() company: LeanCompany, @Param("id") id: string) {
    return TaskMapper.toResponse(await this.taskService.findOne(company._id, id));
  }

  @Post(":id/review")
  @HttpCode(200)
  @ApiOperation({ summary: "Accept or reject a task that is pending review" })
  @ApiParam({ name: "id", example: "6a52217616c2680b4ff69d28" })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: "Task not found for this company" })
  async review(
    @CurrentCompany() company: LeanCompany,
    @Param("id") id: string,
    @Body() dto: ReviewTaskDto,
  ) {
    return TaskMapper.toResponse(await this.taskService.review(company._id, id, dto.action));
  }
}
