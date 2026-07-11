import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type CompanyDocument = HydratedDocument<CompanyEntity>;
export type LeanCompany = CompanyEntity & { _id: Types.ObjectId };

@Schema({ collection: "companies", timestamps: true })
export class CompanyEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  apiKey: string;

  createdAt: Date;
  updatedAt: Date;
}

export const CompanySchema = SchemaFactory.createForClass(CompanyEntity);
