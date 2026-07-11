import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ERROR_CODE } from "../libs/enums/ErrorCode.enum";
import { TASK_STATUS_ENUM } from "../libs/enums/TaskStatus.enum";
import { REVIEW_ACTION_ENUM } from "../libs/enums/ReviewAction.enum";
import { paginate } from "../libs/pagination/pagination";
import { LeanTask, TaskDocument, TaskEntity } from "./task.entity";
import { TaskFilterDto } from "./dto/get-task.dto";

export interface CreateTaskFromEmailInput {
  companyId: Types.ObjectId;
  title: string;
  description?: string;
  dueDate?: Date;
  assigneeId?: Types.ObjectId;
  assigneeEmail?: string;
  llmConfidence?: number;
  source: {
    emailId: Types.ObjectId;
    messageId: string;
    from: string;
    subject: string;
  };
}

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(TaskEntity.name)
    private readonly taskModel: Model<TaskDocument>,
  ) {}

  createFromEmail(input: CreateTaskFromEmailInput) {
    return this.taskModel.create({ ...input, status: TASK_STATUS_ENUM.PENDING_REVIEW });
  }

  findAll(companyId: Types.ObjectId, dto: TaskFilterDto) {
    const filter: Record<string, unknown> = { companyId };
    if (dto.status) filter.status = dto.status;

    return paginate<LeanTask>(this.taskModel, filter, dto);
  }

  async findOne(companyId: Types.ObjectId, id: string): Promise<LeanTask> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({ code: ERROR_CODE.TASK_NOT_FOUND, message: "Task not found" });
    }

    const task = await this.taskModel.findOne({ _id: id, companyId }).lean<LeanTask>().exec();
    if (!task) {
      throw new NotFoundException({ code: ERROR_CODE.TASK_NOT_FOUND, message: "Task not found" });
    }
    return task;
  }

  async review(
    companyId: Types.ObjectId,
    id: string,
    action: REVIEW_ACTION_ENUM,
  ): Promise<LeanTask> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({ code: ERROR_CODE.TASK_NOT_FOUND, message: "Task not found" });
    }

    const nextStatus =
      action === REVIEW_ACTION_ENUM.ACCEPT ? TASK_STATUS_ENUM.ACCEPTED : TASK_STATUS_ENUM.REJECTED;

    const task = await this.taskModel
      .findOneAndUpdate(
        { _id: id, companyId, status: TASK_STATUS_ENUM.PENDING_REVIEW },
        { $set: { status: nextStatus, reviewedAt: new Date() } },
        { new: true },
      )
      .lean<LeanTask>()
      .exec();

    if (task) return task;

    const existing = await this.taskModel.findOne({ _id: id, companyId }).lean<LeanTask>().exec();
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODE.TASK_NOT_FOUND, message: "Task not found" });
    }

    throw new ConflictException({
      code: ERROR_CODE.TASK_ALREADY_REVIEWED,
      message: `Task was already reviewed (status: ${existing.status})`,
    });
  }
}
