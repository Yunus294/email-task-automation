import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { LeanCompany } from "../Company/company.entity";

export const CurrentCompany = createParamDecorator(
  (_data: unknown, context: ExecutionContext): LeanCompany => {
    return context.switchToHttp().getRequest().company;
  },
);
