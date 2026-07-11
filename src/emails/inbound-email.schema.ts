import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type InboundEmailDocument = HydratedDocument<InboundEmail>;

export enum InboundEmailStatus {
  Received = "received",
  Processing = "processing",
  Processed = "processed",
  Discarded = "discarded",
  Unmatched = "unmatched",
  Failed = "failed",
}

@Schema({ timestamps: true })
export class InboundEmail {
  @Prop({ required: true, unique: true })
  messageId: string;

  @Prop({ required: true })
  from: string;

  @Prop({ type: [String], required: true })
  to: string[];

  @Prop({ type: [String], default: [] })
  cc: string[];

  @Prop({ default: "" })
  subject: string;

  @Prop({ default: "" })
  text: string;

  @Prop()
  html?: string;

  @Prop({ type: Date })
  receivedAt?: Date;

  @Prop({
    type: String,
    enum: InboundEmailStatus,
    default: InboundEmailStatus.Received,
    index: true,
  })
  status: InboundEmailStatus;

  @Prop({ type: Types.ObjectId, ref: "Company", index: true })
  companyId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User" })
  matchedUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Task" })
  taskId?: Types.ObjectId;

  @Prop()
  discardReason?: string;

  @Prop()
  error?: string;
}

export const InboundEmailSchema = SchemaFactory.createForClass(InboundEmail);
