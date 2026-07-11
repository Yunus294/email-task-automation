import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Types } from "mongoose";
import { Company } from "./company.schema";

export type CurrentCompanyPayload = Company & { _id: Types.ObjectId };

export const CurrentCompany = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentCompanyPayload => {
    const request = context.switchToHttp().getRequest();
    return request.company;
  },
);
