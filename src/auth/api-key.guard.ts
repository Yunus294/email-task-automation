import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ERROR_CODE } from "../libs/enums/ErrorCode.enum";
import { CompanyDocument, CompanyEntity } from "../Company/company.entity";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectModel(CompanyEntity.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers["x-api-key"];

    if (!apiKey || typeof apiKey !== "string") {
      throw new UnauthorizedException({
        code: ERROR_CODE.UNAUTHORIZED,
        message: "x-api-key header is required",
      });
    }

    const company = await this.companyModel.findOne({ apiKey }).lean().exec();
    if (!company) {
      throw new UnauthorizedException({
        code: ERROR_CODE.INVALID_API_KEY,
        message: "Invalid api key",
      });
    }

    req.company = company;
    return true;
  }
}
