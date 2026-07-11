import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type TaskDocument = HydratedDocument<Task>;

export enum TaskStatus {
  PendingReview = "pending_review",
  Accepted = "accepted",
  Rejected = "rejected",
}

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

@Schema({ timestamps: true })
export class Task {
  @Prop({ type: Types.ObjectId, ref: "Company", required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ type: Types.ObjectId, ref: "User" })
  assigneeId?: Types.ObjectId;

  @Prop()
  assigneeEmail?: string;

  @Prop({ type: String, enum: TaskStatus, default: TaskStatus.PendingReview, index: true })
  status: TaskStatus;

  @Prop({ type: TaskSource })
  source?: TaskSource;

  @Prop({ type: Number })
  llmConfidence?: number;

  @Prop({ type: Date })
  reviewedAt?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ companyId: 1, status: 1, createdAt: -1 });
