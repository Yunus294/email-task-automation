import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { INBOUND_EMAIL_STATUS_ENUM } from "../libs/enums/InboundEmailStatus.enum";
import { UserService } from "../User/user.service";
import { LlmService } from "../Llm/llm.service";
import { TaskService } from "../Task/task.service";
import { InboundEmailService } from "./inboundEmail.service";
import { InboundEmailEntity } from "./inboundEmail.entity";

describe("InboundEmailService", () => {
  let service: InboundEmailService;
  let emailModel: any;
  let userService: { findByAnyEmail: jest.Mock };
  let llmService: { analyzeEmail: jest.Mock };
  let taskService: { createFromEmail: jest.Mock };

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
    status: INBOUND_EMAIL_STATUS_ENUM.PROCESSING,
  };

  beforeEach(async () => {
    emailModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    userService = { findByAnyEmail: jest.fn().mockResolvedValue(null) };
    llmService = { analyzeEmail: jest.fn() };
    taskService = { createFromEmail: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InboundEmailService,
        { provide: getModelToken(InboundEmailEntity.name), useValue: emailModel },
        { provide: UserService, useValue: userService },
        { provide: LlmService, useValue: llmService },
        { provide: TaskService, useValue: taskService },
      ],
    }).compile();

    service = moduleRef.get(InboundEmailService);
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
      emailModel.create.mockResolvedValue({
        ...baseEmail,
        status: INBOUND_EMAIL_STATUS_ENUM.RECEIVED,
      });

      const result = await service.ingest(dto as any);

      expect(emailModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ from: "client@corp.com", to: ["sara@acme.uz"] }),
      );
      expect(service.processInBackground).toHaveBeenCalled();
      expect(result.duplicate).toBe(false);
    });

    it("ignores duplicates that were already handled", async () => {
      emailModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ ...baseEmail, status: INBOUND_EMAIL_STATUS_ENUM.PROCESSED }),
      });

      const result = await service.ingest(dto as any);

      expect(result.duplicate).toBe(true);
      expect(emailModel.create).not.toHaveBeenCalled();
      expect(service.processInBackground).not.toHaveBeenCalled();
    });

    it("retries duplicates that previously failed", async () => {
      emailModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ ...baseEmail, status: INBOUND_EMAIL_STATUS_ENUM.FAILED }),
      });

      const result = await service.ingest(dto as any);

      expect(result.duplicate).toBe(true);
      expect(emailModel.updateOne).toHaveBeenCalledWith(
        { _id: emailId },
        { $set: { status: INBOUND_EMAIL_STATUS_ENUM.RECEIVED, error: null } },
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
      expect(userService.findByAnyEmail).not.toHaveBeenCalled();
    });

    it("marks emails without a matching user as unmatched", async () => {
      claim(baseEmail);
      userService.findByAnyEmail.mockResolvedValue(null);

      await service.process(emailId);

      expect(lastStatusUpdate().status).toBe(INBOUND_EMAIL_STATUS_ENUM.UNMATCHED);
      expect(llmService.analyzeEmail).not.toHaveBeenCalled();
    });

    it("discards emails the llm finds not actionable", async () => {
      claim(baseEmail);
      userService.findByAnyEmail.mockResolvedValue({ _id: userId, companyId });
      llmService.analyzeEmail.mockResolvedValue({ isActionable: false, title: null });

      await service.process(emailId);

      expect(lastStatusUpdate().status).toBe(INBOUND_EMAIL_STATUS_ENUM.DISCARDED);
      expect(taskService.createFromEmail).not.toHaveBeenCalled();
    });

    it("creates a task scoped to the matched user's company", async () => {
      const taskId = new Types.ObjectId();
      claim(baseEmail);
      userService.findByAnyEmail.mockResolvedValue({ _id: userId, companyId });
      llmService.analyzeEmail.mockResolvedValue({
        isActionable: true,
        title: "Fix the login bug",
        description: "Crashes on submit",
        dueDate: "2026-07-20",
        assigneeEmail: null,
        confidence: 0.9,
      });
      taskService.createFromEmail.mockResolvedValue({ _id: taskId, title: "Fix the login bug" });

      await service.process(emailId);

      expect(taskService.createFromEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          title: "Fix the login bug",
          dueDate: new Date("2026-07-20"),
          source: expect.objectContaining({ messageId: "msg-1@test" }),
        }),
      );
      expect(lastStatusUpdate()).toEqual({
        status: INBOUND_EMAIL_STATUS_ENUM.PROCESSED,
        taskId,
      });
    });

    it("drops a suggested assignee that is not in the company", async () => {
      claim(baseEmail);
      userService.findByAnyEmail
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
      taskService.createFromEmail.mockResolvedValue({ _id: new Types.ObjectId() });

      await service.process(emailId);

      expect(userService.findByAnyEmail).toHaveBeenNthCalledWith(
        2,
        ["stranger@other.com"],
        companyId,
      );
      const input = taskService.createFromEmail.mock.calls[0][0];
      expect(input.assigneeId).toBeUndefined();
      expect(input.assigneeEmail).toBeUndefined();
    });

    it("marks the email failed when the llm call blows up", async () => {
      claim(baseEmail);
      userService.findByAnyEmail.mockResolvedValue({ _id: userId, companyId });
      llmService.analyzeEmail.mockRejectedValue(new Error("openai timeout"));

      await service.process(emailId);

      const update = lastStatusUpdate();
      expect(update.status).toBe(INBOUND_EMAIL_STATUS_ENUM.FAILED);
      expect(update.error).toBe("openai timeout");
    });
  });
});
