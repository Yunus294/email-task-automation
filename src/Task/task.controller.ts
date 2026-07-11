import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { CurrentCompany } from "../auth/current-company.decorator";
import { LeanCompany } from "../Company/company.entity";
import { TaskService } from "./task.service";
import { TaskMapper } from "./task.mapper";
import { TaskFilterDto } from "./dto/get-task.dto";
import { ReviewTaskDto } from "./dto/review-task.dto";

@ApiTags("Tasks")
@ApiSecurity("api-key")
@Controller("tasks")
@UseGuards(ApiKeyGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  async findAll(@CurrentCompany() company: LeanCompany, @Query() dto: TaskFilterDto) {
    return TaskMapper.toPage(await this.taskService.findAll(company._id, dto));
  }

  @Get(":id")
  async findOne(@CurrentCompany() company: LeanCompany, @Param("id") id: string) {
    return TaskMapper.toResponse(await this.taskService.findOne(company._id, id));
  }

  @Post(":id/review")
  async review(
    @CurrentCompany() company: LeanCompany,
    @Param("id") id: string,
    @Body() dto: ReviewTaskDto,
  ) {
    return TaskMapper.toResponse(await this.taskService.review(company._id, id, dto.action));
  }
}
