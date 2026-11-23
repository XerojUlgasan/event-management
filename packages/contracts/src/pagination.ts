/** Collection reads are bounded even when the caller omits pagination options. */
export const DEFAULT_PAGE_SIZE = 15;
export const MAX_PAGE_SIZE = 50;
export const MAX_CURSOR_LENGTH = 2048;

export type PaginationQuery = { limit?: number; cursor?: string };

export type PageInfo = { nextCursor: string | null };

export type Page<T> = PageInfo & { items: T[] };

/** Pass SQL rows fetched with limit + 1, before expensive response enrichment. */
export function createPage<T>(
  rows: readonly T[],
  limit: number,
  cursorFor: (row: T) => string,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);

  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined ? cursorFor(last) : null,
  };
}
