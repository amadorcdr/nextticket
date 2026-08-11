import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PaginationQueryDto,
} from './dto/pagination-query.dto';
import {
  buildPaginatedResponse,
  isCacheablePage,
  toPrismaPagination,
} from './pagination.helper';

function query(page: number, limit: number): PaginationQueryDto {
  return { page, limit };
}

describe('pagination.helper', () => {
  describe('toPrismaPagination', () => {
    it('should not skip anything on the first page', () => {
      expect(toPrismaPagination(query(1, 20))).toEqual({ skip: 0, take: 20 });
    });

    it('should skip the pages already served', () => {
      expect(toPrismaPagination(query(3, 20))).toEqual({ skip: 40, take: 20 });
    });
  });

  describe('buildPaginatedResponse', () => {
    it('should report a next page but no previous one on page 1', () => {
      const { meta } = buildPaginatedResponse(['a', 'b'], 7, query(1, 2));

      expect(meta).toEqual({
        total: 7,
        page: 1,
        limit: 2,
        totalPages: 4,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('should report a previous page but no next one on the last page', () => {
      const { meta } = buildPaginatedResponse(['g'], 7, query(4, 2));

      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(true);
    });

    it('should handle an empty result set', () => {
      const { data, meta } = buildPaginatedResponse([], 0, query(1, 20));

      expect(data).toEqual([]);
      expect(meta.totalPages).toBe(0);
      expect(meta.hasNextPage).toBe(false);
    });

    it('should keep the requested page even when it is out of range', () => {
      const { data, meta } = buildPaginatedResponse([], 7, query(99, 2));

      expect(data).toEqual([]);
      expect(meta.page).toBe(99);
      expect(meta.total).toBe(7);
      expect(meta.hasNextPage).toBe(false);
    });
  });

  describe('isCacheablePage', () => {
    it('should only cache the default page', () => {
      expect(isCacheablePage(query(DEFAULT_PAGE, DEFAULT_LIMIT))).toBe(true);
    });

    it('should not cache other pages or limits', () => {
      expect(isCacheablePage(query(2, DEFAULT_LIMIT))).toBe(false);
      expect(isCacheablePage(query(DEFAULT_PAGE, 5))).toBe(false);
    });
  });
});
