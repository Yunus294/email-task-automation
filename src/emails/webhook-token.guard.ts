import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";

@Injectable()
export class WebhookTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("WEBHOOK_TOKEN");
    if (!expected) {
      throw new UnauthorizedException("Webhook token is not configured on the server");
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers["x-webhook-token"];

    if (typeof provided !== "string" || !this.safeCompare(provided, expected)) {
      throw new UnauthorizedException("Invalid webhook token");
    }
    return true;
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
