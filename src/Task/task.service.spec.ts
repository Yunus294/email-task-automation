import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { TASK_STATUS_ENUM } from "../libs/enums/TaskStatus.enum";
import { REVIEW_ACTION_ENUM } from "../libs/enums/ReviewAction.enum";
import { TaskService } from "./task.service";
import { TaskEntity } from "./task.entity";

describe("TaskService", () => {
  let service: TaskService;
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
      providers: [TaskService, { provide: getModelToken(TaskEntity.name), useValue: taskModel }],
    }).compile();

    service = moduleRef.get(TaskService);
  });

  describe("findAll", () => {
    it("filters by company and status with pagination", async () => {
      const findChain = queryChain([{ title: "t1" }]);
      taskModel.find.mockReturnValue(findChain);
      taskModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(41) });

      const result = await service.findAll(companyId, {
        status: TASK_STATUS_ENUM.PENDING_REVIEW,
        page: 3,
        size: 20,
      });

      expect(taskModel.find).toHaveBeenCalledWith({
        companyId,
        status: TASK_STATUS_ENUM.PENDING_REVIEW,
      });
      expect(findChain.skip).toHaveBeenCalledWith(40);
      expect(findChain.limit).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        items: [{ title: "t1" }],
        page: 3,
        size: 20,
        total: 41,
        totalPages: 3,
      });
    });

    it("lists all statuses when no filter is given", async () => {
      taskModel.find.mockReturnValue(queryChain([]));
      taskModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll(companyId, { page: 1, size: 20 });

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
      const updated = { _id: taskId, status: TASK_STATUS_ENUM.ACCEPTED };
      taskModel.findOneAndUpdate.mockReturnValue(queryChain(updated));

      const result = await service.review(companyId, taskId, REVIEW_ACTION_ENUM.ACCEPT);

      expect(taskModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: taskId, companyId, status: TASK_STATUS_ENUM.PENDING_REVIEW },
        { $set: expect.objectContaining({ status: TASK_STATUS_ENUM.ACCEPTED }) },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it("rejects a pending task", async () => {
      taskModel.findOneAndUpdate.mockReturnValue(
        queryChain({ _id: taskId, status: TASK_STATUS_ENUM.REJECTED }),
      );

      const result = await service.review(companyId, taskId, REVIEW_ACTION_ENUM.REJECT);
      expect(result.status).toBe(TASK_STATUS_ENUM.REJECTED);
    });

    it("throws 409 when the task was already reviewed", async () => {
      taskModel.findOneAndUpdate.mockReturnValue(queryChain(null));
      taskModel.findOne.mockReturnValue(
        queryChain({ _id: taskId, status: TASK_STATUS_ENUM.ACCEPTED }),
      );

      await expect(service.review(companyId, taskId, REVIEW_ACTION_ENUM.ACCEPT)).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws 404 when the task belongs to another company", async () => {
      taskModel.findOneAndUpdate.mockReturnValue(queryChain(null));
      taskModel.findOne.mockReturnValue(queryChain(null));

      await expect(service.review(companyId, taskId, REVIEW_ACTION_ENUM.ACCEPT)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
