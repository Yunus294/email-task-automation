import { FilterQuery, Model, SortOrder } from "mongoose";
import { PagePaginationDto } from "./page-pagination.dto";

export interface PagePaginationResult<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  dto: PagePaginationDto,
  sort: Record<string, SortOrder> = { createdAt: -1 },
): Promise<PagePaginationResult<T>> {
  const page = dto.page ?? 1;
  const size = dto.size ?? 20;

  const [items, total] = await Promise.all([
    model
      .find(filter)
      .sort(sort)
      .skip((page - 1) * size)
      .limit(size)
      .lean<T[]>()
      .exec(),
    model.countDocuments(filter).exec(),
  ]);

  return {
    items,
    page,
    size,
    total,
    totalPages: Math.ceil(total / size),
  };
}
