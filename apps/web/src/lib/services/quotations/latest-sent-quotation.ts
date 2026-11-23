import {
  getQuotations,
  type Quotation,
} from "../../data/quotations/quotations";

/** The booking history API resolves the latest delivered offer across all pages. */
export async function getLatestSentQuotation(
  bookingId: string,
  admin: boolean,
  load = getQuotations,
): Promise<Quotation | null> {
  const { currentOffer } = await load(bookingId, admin);

  return currentOffer;
}
