import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { ListTasksDto } from "./dto/list-tasks.dto";
import { ReviewTaskDto } from "./dto/review-task.dto";
import { ApiKeyGuard } from "../companies/api-key.guard";
import { CurrentCompany, CurrentCompanyPayload } from "../companies/current-company.decorator";

@Controller("tasks")
@UseGuards(ApiKeyGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@CurrentCompany() company: CurrentCompanyPayload, @Query() query: ListTasksDto) {
    return this.tasksService.list(company._id, query);
  }

  @Get(":id")
  findOne(@CurrentCompany() company: CurrentCompanyPayload, @Param("id") id: string) {
    return this.tasksService.findOne(company._id, id);
  }

  @Post(":id/review")
  review(
    @CurrentCompany() company: CurrentCompanyPayload,
    @Param("id") id: string,
    @Body() dto: ReviewTaskDto,
  ) {
    return this.tasksService.review(company._id, id, dto.action);
  }
}
