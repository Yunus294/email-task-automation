import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
import { ERROR_CODE } from "../libs/enums/ErrorCode.enum";

@Injectable()
export class WebhookTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("WEBHOOK_TOKEN");
    const provided = context.switchToHttp().getRequest().headers["x-webhook-token"];

    if (!expected || typeof provided !== "string" || !this.safeCompare(provided, expected)) {
      throw new UnauthorizedException({
        code: ERROR_CODE.INVALID_WEBHOOK_TOKEN,
        message: "Invalid webhook token",
      });
    }
    return true;
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
