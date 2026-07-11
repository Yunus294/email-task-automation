import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { TasksService } from "./tasks.service";
import { Task, TaskStatus } from "./task.schema";

describe("TasksService", () => {
  let service: TasksService;
  let taskModel: any;

  const companyId = new Types.ObjectId();
  const taskId = new Types.ObjectId().toString();

  const queryChain = (result: unknown) => {
    const chain: any = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(result),
    };
    return chain;
  };

  beforeEach(async () => {
    taskModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [TasksService, { provide: getModelToken(Task.name), useValue: taskModel }],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  describe("list", () => {
    it("filters by company and status with pagination", async () => {
      const findChain = queryChain([{ title: "t1" }]);
      taskModel.find.mockReturnValue(findChain);
      taskModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(41) });

      const result = await service.list(companyId, {
        status: TaskStatus.PendingReview,
        page: 3,
        limit: 20,
      });

      expect(taskModel.find).toHaveBeenCalledWith({
        companyId,
        status: TaskStatus.PendingReview,
      });
      expect(findChain.skip).toHaveBeenCalledWith(40);
      expect(findChain.limit).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        items: [{ title: "t1" }],
        total: 41,
        page: 3,
        limit: 20,
        totalPages: 3,
      });
    });

    it("lists all statuses when no filter is given", async () => {
      taskModel.find.mockReturnValue(queryChain([]));
      taskModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.list(companyId, { page: 1, limit: 20 });

      expect(taskModel.find).toHaveBeenCalledWith({ companyId });
    });
  });

  describe("findOne", () => {
    it("throws 404 for ids outside the company", async () => {
      taskModel.findOne.mockReturnValue(queryChain(null));

      await expect(service.findOne(companyId, taskId)).rejects.toThrow(NotFoundException);
      expect(taskModel.findOne).toHaveBeenCalledWith({ _id: taskId, companyId });
    });

    it("throws 404 for malformed ids instead of a cast error", async () => {
      await expect(service.findOne(companyId, "not-an-id")).rejects.toThrow(NotFoundException);
      expect(taskModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe("review", () => {
    it("accepts a pending task", async () => {
      const updated = { _id: taskId, status: TaskStatus.Accepted };
      taskModel.findOneAndUpdate.mockReturnValue(queryChain(updated));

      const result = await service.review(companyId, taskId, "accept");

      expect(taskModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: taskId, companyId, status: TaskStatus.PendingReview },
        { $set: expect.objectContaining({ status: TaskStatus.Accepted }) },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it("rejects a pending task", async () => {
      taskModel.findOneAndUpdate.mockReturnValue(
        queryChain({ _id: taskId, status: TaskStatus.Rejected }),
      );

      const result: any = await service.review(companyId, taskId, "reject");
      expect(result.status).toBe(TaskStatus.Rejected);
    });

    it("throws 409 when the task was already reviewed", async () => {
      taskModel.findOneAndUpdate.mockReturnValue(queryChain(null));
      taskModel.findOne.mockReturnValue(
        queryChain({ _id: taskId, status: TaskStatus.Accepted }),
      );

      await expect(service.review(companyId, taskId, "accept")).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws 404 when the task belongs to another company", async () => {
      taskModel.findOneAndUpdate.mockReturnValue(queryChain(null));
      taskModel.findOne.mockReturnValue(queryChain(null));

      await expect(service.review(companyId, taskId, "accept")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
