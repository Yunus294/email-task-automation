import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { EmailsService } from "./emails.service";
import { InboundEmail, InboundEmailStatus } from "./inbound-email.schema";
import { UsersService } from "../users/users.service";
import { LlmService } from "../llm/llm.service";
import { TasksService } from "../tasks/tasks.service";

describe("EmailsService", () => {
  let service: EmailsService;
  let emailModel: any;
  let usersService: { findByAnyEmail: jest.Mock };
  let llmService: { analyzeEmail: jest.Mock };
  let tasksService: { createFromEmail: jest.Mock };

  const emailId = new Types.ObjectId();
  const companyId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  const baseEmail = {
    _id: emailId,
    messageId: "msg-1@test",
    from: "client@corp.com",
    to: ["sara@acme.uz"],
    cc: [],
    subject: "Fix the login bug",
    text: "It crashes on submit, please fix by 2026-07-20",
    status: InboundEmailStatus.Processing,
  };

  beforeEach(async () => {
    emailModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    usersService = { findByAnyEmail: jest.fn().mockResolvedValue(null) };
    llmService = { analyzeEmail: jest.fn() };
    tasksService = { createFromEmail: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailsService,
        { provide: getModelToken(InboundEmail.name), useValue: emailModel },
        { provide: UsersService, useValue: usersService },
        { provide: LlmService, useValue: llmService },
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();

    service = moduleRef.get(EmailsService);
    jest.spyOn(service, "processInBackground").mockImplementation(() => undefined);
  });

  describe("ingest", () => {
    const dto = {
      messageId: "msg-1@test",
      from: "Client@Corp.com",
      to: ["Sara@Acme.uz"],
      subject: "Hello",
      text: "body",
    };

    it("stores a new email and kicks off processing", async () => {
      emailModel.create.mockResolvedValue({ ...baseEmail, status: InboundEmailStatus.Received });

      const result = await service.ingest(dto as any);

      expect(emailModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ from: "client@corp.com", to: ["sara@acme.uz"] }),
      );
      expect(service.processInBackground).toHaveBeenCalled();
      expect(result.duplicate).toBe(false);
    });

    it("ignores duplicates that were already handled", async () => {
      emailModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...baseEmail, status: InboundEmailStatus.Processed }),
      });

      const result = await service.ingest(dto as any);

      expect(result.duplicate).toBe(true);
      expect(emailModel.create).not.toHaveBeenCalled();
      expect(service.processInBackground).not.toHaveBeenCalled();
    });

    it("retries duplicates that previously failed", async () => {
      emailModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...baseEmail, status: InboundEmailStatus.Failed }),
      });

      const result = await service.ingest(dto as any);

      expect(result.duplicate).toBe(true);
      expect(emailModel.updateOne).toHaveBeenCalledWith(
        { _id: emailId },
        { $set: { status: InboundEmailStatus.Received, error: null } },
      );
      expect(service.processInBackground).toHaveBeenCalledWith(emailId);
    });
  });

  describe("process", () => {
    const claim = (email: any) => {
      emailModel.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(email) });
    };

    const lastStatusUpdate = () => {
      const calls = emailModel.updateOne.mock.calls;
      return calls[calls.length - 1][1].$set;
    };

    it("does nothing when the email was already claimed", async () => {
      claim(null);
      await service.process(emailId);
      expect(usersService.findByAnyEmail).not.toHaveBeenCalled();
    });

    it("marks emails without a matching user as unmatched", async () => {
      claim(baseEmail);
      usersService.findByAnyEmail.mockResolvedValue(null);

      await service.process(emailId);

      expect(lastStatusUpdate().status).toBe(InboundEmailStatus.Unmatched);
      expect(llmService.analyzeEmail).not.toHaveBeenCalled();
    });

    it("discards emails the llm finds not actionable", async () => {
      claim(baseEmail);
      usersService.findByAnyEmail.mockResolvedValue({ _id: userId, companyId });
      llmService.analyzeEmail.mockResolvedValue({ isActionable: false, title: null });

      await service.process(emailId);

      expect(lastStatusUpdate().status).toBe(InboundEmailStatus.Discarded);
      expect(tasksService.createFromEmail).not.toHaveBeenCalled();
    });

    it("creates a task scoped to the matched user's company", async () => {
      const taskId = new Types.ObjectId();
      claim(baseEmail);
      usersService.findByAnyEmail.mockResolvedValue({ _id: userId, companyId });
      llmService.analyzeEmail.mockResolvedValue({
        isActionable: true,
        title: "Fix the login bug",
        description: "Crashes on submit",
        dueDate: "2026-07-20",
        assigneeEmail: null,
        confidence: 0.9,
      });
      tasksService.createFromEmail.mockResolvedValue({ _id: taskId, title: "Fix the login bug" });

      await service.process(emailId);

      expect(tasksService.createFromEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          title: "Fix the login bug",
          dueDate: new Date("2026-07-20"),
          source: expect.objectContaining({ messageId: "msg-1@test" }),
        }),
      );
      expect(lastStatusUpdate()).toEqual({ status: InboundEmailStatus.Processed, taskId });
    });

    it("drops a suggested assignee that is not in the company", async () => {
      claim(baseEmail);
      usersService.findByAnyEmail
        .mockResolvedValueOnce({ _id: userId, companyId })
        .mockResolvedValueOnce(null);
      llmService.analyzeEmail.mockResolvedValue({
        isActionable: true,
        title: "Pay invoice",
        description: null,
        dueDate: null,
        assigneeEmail: "stranger@other.com",
        confidence: 0.7,
      });
      tasksService.createFromEmail.mockResolvedValue({ _id: new Types.ObjectId() });

      await service.process(emailId);

      expect(usersService.findByAnyEmail).toHaveBeenNthCalledWith(
        2,
        ["stranger@other.com"],
        companyId,
      );
      const input = tasksService.createFromEmail.mock.calls[0][0];
      expect(input.assigneeId).toBeUndefined();
      expect(input.assigneeEmail).toBeUndefined();
    });

    it("marks the email failed when the llm call blows up", async () => {
      claim(baseEmail);
      usersService.findByAnyEmail.mockResolvedValue({ _id: userId, companyId });
      llmService.analyzeEmail.mockRejectedValue(new Error("openai timeout"));

      await service.process(emailId);

      const update = lastStatusUpdate();
      expect(update.status).toBe(InboundEmailStatus.Failed);
      expect(update.error).toBe("openai timeout");
    });
  });
});
