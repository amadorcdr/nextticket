import { PaginatedResponseDto } from './dto/paginated-response.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PaginationQueryDto,
} from './dto/pagination-query.dto';

/** Translates page/limit into the skip/take arguments Prisma expects. */
export function toPrismaPagination(pagination: PaginationQueryDto) {
  return {
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit,
  };
}

/**
 * The list cache keeps a single entry per resource, so it can only hold the
 * default page. Any other page or limit is always read from PostgreSQL.
 */
export function isCacheablePage(pagination: PaginationQueryDto) {
  return pagination.page === DEFAULT_PAGE && pagination.limit === DEFAULT_LIMIT;
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationQueryDto,
): PaginatedResponseDto<T> {
  const totalPages = Math.ceil(total / pagination.limit);

  return {
    data,
    meta: {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
    },
  };
}
