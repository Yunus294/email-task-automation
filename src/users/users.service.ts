import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "./user.schema";

export type LeanUser = User & { _id: Types.ObjectId };

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async findByAnyEmail(emails: string[], companyId?: Types.ObjectId): Promise<LeanUser | null> {
    const normalized = emails.filter(Boolean).map((e) => e.trim().toLowerCase());
    if (normalized.length === 0) return null;

    const filter: Record<string, unknown> = { emails: { $in: normalized } };
    if (companyId) filter.companyId = companyId;

    return this.userModel.findOne(filter).lean<LeanUser>().exec();
  }
}
