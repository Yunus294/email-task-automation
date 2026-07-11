import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: Types.ObjectId, ref: "Company", required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], required: true, index: true, lowercase: true })
  emails: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
