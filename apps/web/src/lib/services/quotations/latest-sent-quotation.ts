import {
  getQuotations,
  type Quotation,
} from "../../data/quotations/quotations";

type QuotationsLoader =
  typeof import("../../data/quotations/quotations").getQuotations;
type QuotationsPage = Awaited<ReturnType<QuotationsLoader>>;

/**
 * Find the newest sent quotation, continuing through pages that contain only
 * drafts or no rows. The API orders versions newest first for this booking.
 */
export async function findLatestSentQuotation(
  bookingId: string,
  admin: boolean,
  load: QuotationsLoader = getQuotations,
): Promise<Quotation | null> {
  let cursor: string | undefined;
  const requestedCursors = new Set<string>();

  while (true) {
    const page: QuotationsPage = await load(
      bookingId,
      admin,
      cursor ? { cursor } : {},
    );
    const quotation = page.quotations.find(
      (item) => item.sentAt !== null && item.status !== "draft",
    );
    if (quotation) return quotation;

    if (!page.nextCursor) return null;
    if (requestedCursors.has(page.nextCursor))
      throw new Error("Unable to load quotation history. Please try again.");
    requestedCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}

export function getLatestSentQuotation(
  bookingId: string,
  admin: boolean,
): Promise<Quotation | null> {
  return findLatestSentQuotation(bookingId, admin);
}
