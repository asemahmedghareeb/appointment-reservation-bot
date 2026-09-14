import type { PaginatedResult } from '@visaflow/shared-types';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function normalizePagination(page?: number, limit?: number): { page: number; limit: number; skip: number } {
  const resolvedPage = Math.max(1, Math.floor(page || DEFAULT_PAGE));
  const resolvedLimit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit || DEFAULT_LIMIT)));
  const skip = (resolvedPage - 1) * resolvedLimit;

  return {
    page: resolvedPage,
    limit: resolvedLimit,
    skip,
  };
}

export function createPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    items,
    page,
    limit,
    total,
    totalPages,
  };
}
