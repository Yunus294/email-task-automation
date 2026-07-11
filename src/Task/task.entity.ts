import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { TASK_STATUS_ENUM } from "../libs/enums/TaskStatus.enum";

export type TaskDocument = HydratedDocument<TaskEntity>;
export type LeanTask = TaskEntity & { _id: Types.ObjectId };

@Schema({ _id: false })
export class TaskSource {
  @Prop({ type: Types.ObjectId })
  emailId: Types.ObjectId;

  @Prop()
  messageId: string;

  @Prop()
  from: string;

  @Prop()
  subject: string;
}

@Schema({ collection: "tasks", timestamps: true })
export class TaskEntity {
  @Prop({ type: Types.ObjectId, ref: "CompanyEntity", required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ nullable: true })
  description?: string;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ type: Types.ObjectId, ref: "UserEntity" })
  assigneeId?: Types.ObjectId;

  @Prop()
  assigneeEmail?: string;

  @Prop({
    type: String,
    enum: TASK_STATUS_ENUM,
    default: TASK_STATUS_ENUM.PENDING_REVIEW,
    index: true,
  })
  status: TASK_STATUS_ENUM;

  @Prop({ type: TaskSource })
  source?: TaskSource;

  @Prop({ type: Number })
  llmConfidence?: number;

  @Prop({ type: Date })
  reviewedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const TaskSchema = SchemaFactory.createForClass(TaskEntity);
TaskSchema.index({ companyId: 1, status: 1, createdAt: -1 });
