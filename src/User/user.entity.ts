import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type UserDocument = HydratedDocument<UserEntity>;
export type LeanUser = UserEntity & { _id: Types.ObjectId };

@Schema({ collection: "users", timestamps: true })
export class UserEntity {
  @Prop({ type: Types.ObjectId, ref: "CompanyEntity", required: true, index: true })
  companyId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: [String], required: true, index: true, lowercase: true })
  emails!: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(UserEntity);
