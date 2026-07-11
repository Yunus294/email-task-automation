import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { LeanUser, UserDocument, UserEntity } from "./user.entity";

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserEntity.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  findByAnyEmail(emails: string[], companyId?: Types.ObjectId): Promise<LeanUser | null> {
    const normalized = emails.filter(Boolean).map((email) => email.trim().toLowerCase());
    if (normalized.length === 0) return Promise.resolve(null);

    const filter: Record<string, unknown> = { emails: { $in: normalized } };
    if (companyId) filter.companyId = companyId;

    return this.userModel.findOne(filter).lean<LeanUser>().exec();
  }
}
