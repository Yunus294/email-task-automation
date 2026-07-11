import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { INBOUND_EMAIL_STATUS_ENUM } from "../libs/enums/InboundEmailStatus.enum";

export type InboundEmailDocument = HydratedDocument<InboundEmailEntity>;
export type LeanInboundEmail = InboundEmailEntity & { _id: Types.ObjectId };

@Schema({ collection: "inbound_emails", timestamps: true })
export class InboundEmailEntity {
  @Prop({ required: true, unique: true })
  messageId!: string;

  @Prop({ required: true })
  from!: string;

  @Prop({ type: [String], required: true })
  to!: string[];

  @Prop({ type: [String], default: [] })
  cc!: string[];

  @Prop({ default: "" })
  subject!: string;

  @Prop({ default: "" })
  text!: string;

  @Prop({ nullable: true })
  html?: string;

  @Prop({ type: Date })
  receivedAt?: Date;

  @Prop({
    type: String,
    enum: INBOUND_EMAIL_STATUS_ENUM,
    default: INBOUND_EMAIL_STATUS_ENUM.RECEIVED,
    index: true,
  })
  status!: INBOUND_EMAIL_STATUS_ENUM;

  @Prop({ type: Types.ObjectId, ref: "CompanyEntity", index: true })
  companyId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "UserEntity" })
  matchedUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "TaskEntity" })
  taskId?: Types.ObjectId;

  @Prop()
  discardReason?: string;

  @Prop()
  error?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const InboundEmailSchema = SchemaFactory.createForClass(InboundEmailEntity);
