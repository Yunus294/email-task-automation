import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Company, CompanyDocument } from "./company.schema";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-api-key"];

    if (!apiKey || typeof apiKey !== "string") {
      throw new UnauthorizedException("x-api-key header is required");
    }

    const company = await this.companyModel.findOne({ apiKey }).lean().exec();
    if (!company) {
      throw new UnauthorizedException("Invalid api key");
    }

    request.company = company;
    return true;
  }
}
