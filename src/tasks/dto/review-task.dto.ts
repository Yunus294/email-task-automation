import { IsIn } from "class-validator";

export type ReviewAction = "accept" | "reject";

export class ReviewTaskDto {
  @IsIn(["accept", "reject"])
  action: ReviewAction;
}
