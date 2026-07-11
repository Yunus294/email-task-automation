import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Task, TaskDocument, TaskStatus } from "./task.schema";
import { ListTasksDto } from "./dto/list-tasks.dto";
import { ReviewAction } from "./dto/review-task.dto";

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
export class TasksService {
  constructor(@InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>) {}

  async createFromEmail(input: CreateTaskFromEmailInput): Promise<TaskDocument> {
    return this.taskModel.create({
      ...input,
      status: TaskStatus.PendingReview,
    });
  }

  async list(companyId: Types.ObjectId, query: ListTasksDto) {
    const filter: Record<string, unknown> = { companyId };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.taskModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async findOne(companyId: Types.ObjectId, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Task not found");
    }
    const task = await this.taskModel.findOne({ _id: id, companyId }).lean().exec();
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  async review(companyId: Types.ObjectId, id: string, action: ReviewAction) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Task not found");
    }

    const nextStatus = action === "accept" ? TaskStatus.Accepted : TaskStatus.Rejected;
    const task = await this.taskModel
      .findOneAndUpdate(
        { _id: id, companyId, status: TaskStatus.PendingReview },
        { $set: { status: nextStatus, reviewedAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec();

    if (task) return task;

    const exists = await this.taskModel.findOne({ _id: id, companyId }).lean().exec();
    if (!exists) {
      throw new NotFoundException("Task not found");
    }
    throw new ConflictException(`Task was already reviewed (status: ${exists.status})`);
  }
}
