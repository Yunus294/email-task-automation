import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { InboundEmail, InboundEmailDocument, InboundEmailStatus } from "./inbound-email.schema";
import { InboundEmailDto } from "./dto/inbound-email.dto";
import { UsersService } from "../users/users.service";
import { LlmService } from "../llm/llm.service";
import { TasksService } from "../tasks/tasks.service";

type LeanEmail = InboundEmail & { _id: Types.ObjectId };

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  constructor(
    @InjectModel(InboundEmail.name)
    private readonly emailModel: Model<InboundEmailDocument>,
    private readonly usersService: UsersService,
    private readonly llmService: LlmService,
    private readonly tasksService: TasksService,
  ) {}

  async ingest(dto: InboundEmailDto): Promise<{ id: string; status: string; duplicate: boolean }> {
    const existing = await this.emailModel.findOne({ messageId: dto.messageId }).lean<LeanEmail>();

    if (existing && existing.status !== InboundEmailStatus.Failed) {
      return { id: existing._id.toString(), status: existing.status, duplicate: true };
    }

    if (existing) {
      await this.emailModel.updateOne(
        { _id: existing._id },
        { $set: { status: InboundEmailStatus.Received, error: null } },
      );
      this.processInBackground(existing._id);
      return { id: existing._id.toString(), status: InboundEmailStatus.Received, duplicate: true };
    }

    const email = await this.emailModel.create({
      messageId: dto.messageId,
      from: dto.from.toLowerCase(),
      to: dto.to.map((e) => e.toLowerCase()),
      cc: (dto.cc ?? []).map((e) => e.toLowerCase()),
      subject: dto.subject ?? "",
      text: dto.text ?? "",
      html: dto.html,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
      status: InboundEmailStatus.Received,
    });

    this.processInBackground(email._id);
    return { id: email._id.toString(), status: email.status, duplicate: false };
  }

  processInBackground(emailId: Types.ObjectId) {
    this.process(emailId).catch((err) => {
      this.logger.error(`Unhandled error while processing email ${emailId}: ${err?.message}`);
    });
  }

  async process(emailId: Types.ObjectId): Promise<void> {
    const claimed = await this.emailModel
      .findOneAndUpdate(
        { _id: emailId, status: InboundEmailStatus.Received },
        { $set: { status: InboundEmailStatus.Processing } },
        { new: true },
      )
      .lean<LeanEmail>();

    if (!claimed) return;

    try {
      const recipients = [...claimed.to, ...claimed.cc];
      const user = await this.usersService.findByAnyEmail(recipients);

      if (!user) {
        await this.finish(emailId, {
          status: InboundEmailStatus.Unmatched,
          discardReason: "no user matches the recipient addresses",
        });
        this.logger.warn(`Email ${claimed.messageId} did not match any user, skipping`);
        return;
      }

      await this.emailModel.updateOne(
        { _id: emailId },
        { $set: { companyId: user.companyId, matchedUserId: user._id } },
      );

      const body = claimed.text || this.stripHtml(claimed.html ?? "");
      const analysis = await this.llmService.analyzeEmail({
        from: claimed.from,
        subject: claimed.subject,
        body,
      });

      if (!analysis.isActionable || !analysis.title) {
        await this.finish(emailId, {
          status: InboundEmailStatus.Discarded,
          discardReason: "llm classified as not actionable",
        });
        this.logger.log(`Email ${claimed.messageId} is not actionable, discarded`);
        return;
      }

      let assigneeId: Types.ObjectId | undefined;
      let assigneeEmail: string | undefined;
      if (analysis.assigneeEmail) {
        const assignee = await this.usersService.findByAnyEmail(
          [analysis.assigneeEmail],
          user.companyId,
        );
        if (assignee) {
          assigneeId = assignee._id;
          assigneeEmail = analysis.assigneeEmail;
        } else {
          this.logger.warn(
            `Suggested assignee ${analysis.assigneeEmail} is not a user of the company, dropping it`,
          );
        }
      }

      const task = await this.tasksService.createFromEmail({
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

      await this.finish(emailId, { status: InboundEmailStatus.Processed, taskId: task._id });
      this.logger.log(`Email ${claimed.messageId} -> task ${task._id} ("${task.title}")`);
    } catch (err: any) {
      await this.finish(emailId, {
        status: InboundEmailStatus.Failed,
        error: err?.message ?? "unknown error",
      });
      this.logger.error(`Failed to process email ${claimed.messageId}: ${err?.message}`);
    }
  }

  private async finish(emailId: Types.ObjectId, fields: Record<string, unknown>) {
    await this.emailModel.updateOne({ _id: emailId }, { $set: fields });
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
