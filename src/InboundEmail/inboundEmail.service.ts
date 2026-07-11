import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { INBOUND_EMAIL_STATUS_ENUM } from "../libs/enums/InboundEmailStatus.enum";
import { UserService } from "../User/user.service";
import { LlmService } from "../Llm/llm.service";
import { TaskService } from "../Task/task.service";
import { InboundEmailDocument, InboundEmailEntity, LeanInboundEmail } from "./inboundEmail.entity";
import { CreateInboundEmailDto } from "./dto/create-inboundEmail.dto";

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);

  constructor(
    @InjectModel(InboundEmailEntity.name)
    private readonly emailModel: Model<InboundEmailDocument>,
    private readonly userService: UserService,
    private readonly llmService: LlmService,
    private readonly taskService: TaskService,
  ) {}

  async ingest(dto: CreateInboundEmailDto) {
    const existing = await this.emailModel
      .findOne({ messageId: dto.messageId })
      .lean<LeanInboundEmail>();

    if (existing && existing.status !== INBOUND_EMAIL_STATUS_ENUM.FAILED) {
      return { id: existing._id.toString(), status: existing.status, duplicate: true };
    }

    if (existing) {
      await this.emailModel.updateOne(
        { _id: existing._id },
        { $set: { status: INBOUND_EMAIL_STATUS_ENUM.RECEIVED, error: null } },
      );
      this.processInBackground(existing._id);
      return {
        id: existing._id.toString(),
        status: INBOUND_EMAIL_STATUS_ENUM.RECEIVED,
        duplicate: true,
      };
    }

    const email = await this.emailModel.create({
      messageId: dto.messageId,
      from: dto.from.toLowerCase(),
      to: dto.to.map((address) => address.toLowerCase()),
      cc: (dto.cc ?? []).map((address) => address.toLowerCase()),
      subject: dto.subject ?? "",
      text: dto.text ?? "",
      html: dto.html,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
      status: INBOUND_EMAIL_STATUS_ENUM.RECEIVED,
    });

    this.processInBackground(email._id);
    return { id: email._id.toString(), status: email.status, duplicate: false };
  }

  processInBackground(emailId: Types.ObjectId) {
    this.process(emailId).catch((e) => this.logger.error(e));
  }

  async process(emailId: Types.ObjectId): Promise<void> {
    const claimed = await this.emailModel
      .findOneAndUpdate(
        { _id: emailId, status: INBOUND_EMAIL_STATUS_ENUM.RECEIVED },
        { $set: { status: INBOUND_EMAIL_STATUS_ENUM.PROCESSING } },
        { new: true },
      )
      .lean<LeanInboundEmail>();

    if (!claimed) return;

    try {
      const user = await this.userService.findByAnyEmail([...claimed.to, ...claimed.cc]);
      if (!user) {
        await this.finish(emailId, {
          status: INBOUND_EMAIL_STATUS_ENUM.UNMATCHED,
          discardReason: "no user matches the recipient addresses",
        });
        return;
      }

      await this.emailModel.updateOne(
        { _id: emailId },
        { $set: { companyId: user.companyId, matchedUserId: user._id } },
      );

      const analysis = await this.llmService.analyzeEmail({
        from: claimed.from,
        subject: claimed.subject,
        body: claimed.text || this.stripHtml(claimed.html ?? ""),
      });

      if (!analysis.isActionable || !analysis.title) {
        await this.finish(emailId, {
          status: INBOUND_EMAIL_STATUS_ENUM.DISCARDED,
          discardReason: "llm classified as not actionable",
        });
        return;
      }

      let assigneeId: Types.ObjectId | undefined;
      let assigneeEmail: string | undefined;
      if (analysis.assigneeEmail) {
        const assignee = await this.userService.findByAnyEmail(
          [analysis.assigneeEmail],
          user.companyId,
        );
        if (assignee) {
          assigneeId = assignee._id;
          assigneeEmail = analysis.assigneeEmail;
        }
      }

      const task = await this.taskService.createFromEmail({
        companyId: user.companyId,
        title: analysis.title,
        description: analysis.description ?? undefined,
        dueDate: analysis.dueDate ? new Date(analysis.dueDate) : undefined,
        assigneeId,
        assigneeEmail,
        llmConfidence: analysis.confidence,
        source: {
          emailId,
          messageId: claimed.messageId,
          from: claimed.from,
          subject: claimed.subject,
        },
      });

      await this.finish(emailId, {
        status: INBOUND_EMAIL_STATUS_ENUM.PROCESSED,
        taskId: task._id,
      });
    } catch (e: any) {
      this.logger.error(e);
      await this.finish(emailId, {
        status: INBOUND_EMAIL_STATUS_ENUM.FAILED,
        error: e?.message ?? "unknown error",
      });
    }
  }

  private finish(emailId: Types.ObjectId, fields: Record<string, unknown>) {
    return this.emailModel.updateOne({ _id: emailId }, { $set: fields });
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
