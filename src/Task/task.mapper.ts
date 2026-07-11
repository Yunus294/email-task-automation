import { PagePaginationResult } from "../libs/pagination/pagination";
import { LeanTask } from "./task.entity";

export class TaskMapper {
  static toResponse(task: LeanTask) {
    return {
      id: task._id.toString(),
      companyId: task.companyId?.toString(),
      title: task.title,
      description: task.description ?? null,
      dueDate: task.dueDate ?? null,
      assigneeId: task.assigneeId ? task.assigneeId.toString() : null,
      assigneeEmail: task.assigneeEmail ?? null,
      status: task.status,
      source: task.source
        ? {
            emailId: task.source.emailId?.toString(),
            messageId: task.source.messageId,
            from: task.source.from,
            subject: task.source.subject,
          }
        : null,
      llmConfidence: task.llmConfidence ?? null,
      reviewedAt: task.reviewedAt ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  static toPage(result: PagePaginationResult<LeanTask>) {
    return {
      items: result.items.map((task) => TaskMapper.toResponse(task)),
      page: result.page,
      size: result.size,
      total: result.total,
      totalPages: result.totalPages,
    };
  }
}
