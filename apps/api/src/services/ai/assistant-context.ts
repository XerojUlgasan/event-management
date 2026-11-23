import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { getBookingRequestService } from "../booking-requests/get-booking-request.js";
import { z } from "@hono/zod-openapi";
import { MAX_CURSOR_LENGTH } from "@event-management/contracts/pagination";
import { catalogRecommendationsSchema } from "@event-management/contracts/messages";
import {
  getLastCatalogToolCallData,
  listDeliveredCatalogSearchesData,
} from "../../data/ai/get-last-catalog-tool-call.js";
import { searchPublicCatalogInputSchema } from "./search-public-catalog.js";
import { getPublicCatalogItemInputSchema } from "./get-public-catalog-item.js";

const shownItemSchema = z.object({
  id: z.uuid(),
  type: z.enum(["package", "service"]),
  name: z.string(),
  url: z.string(),
});

async function deliveredShortlist(
  db: Kysely<DB>,
  reply: { replyBody: string; replyId: string },
) {
  // The model may reorder, omit or combine search results in its answer.
  const links = [
    ...reply.replyBody.matchAll(/\]\((\/(?:packages|services)\/[^()\s]+)\)/gu),
  ].map((match) => match[1]);

  if (!links.length) return undefined;

  if (new Set(links).size !== links.length) return null;

  const searches = await listDeliveredCatalogSearchesData(db, reply.replyId);
  const items = new Map<string, z.infer<typeof shownItemSchema>>();

  for (const { output } of searches) {
    const results = z
      .object({ results: z.array(shownItemSchema) })
      .safeParse(output);

    if (results.success)
      for (const item of results.data.results) items.set(item.url, item);
  }

  const shown = links.flatMap((url) =>
    url && items.has(url) ? [items.get(url)!] : [],
  );

  return shown.length === links.length ? shown : null;
}

export async function buildPreviousCatalogSearchContext({
  db,
  conversationId,
  customerMessageId,
}: {
  db: Kysely<DB>;
  conversationId: string;
  customerMessageId: string;
}) {
  const previous = await getLastCatalogToolCallData(db, {
    conversationId,
    customerMessageId,
    toolName: "searchPublicCatalog",
  });

  if (!previous) return undefined;

  const input = searchPublicCatalogInputSchema.safeParse(previous.input);
  const output = z
    .object({ nextCursor: z.string().min(1).max(MAX_CURSOR_LENGTH).nullable() })
    .safeParse(previous.output);

  if (!input.success || !output.success) return undefined;

  const shownItems = await deliveredShortlist(db, previous);

  return {
    input: input.data,
    nextCursor: output.data.nextCursor,
    triggerMessageId: previous.triggerMessageId,
    replyId: previous.replyId,
    replyOrder: previous.replyOrder,
    ambiguousShortlist: shownItems === null,
    ...(shownItems ? { shownItems } : {}),
  };
}

export async function buildPreviousCatalogRecommendationsContext({
  db,
  conversationId,
  customerMessageId,
}: {
  db: Kysely<DB>;
  conversationId: string;
  customerMessageId: string;
}) {
  const previous = await getLastCatalogToolCallData(db, {
    conversationId,
    customerMessageId,
    toolName: "attachCatalogRecommendations",
  });
  const items = catalogRecommendationsSchema.safeParse(
    previous?.recommendations,
  );

  if (!previous || !items.success) return undefined;

  return {
    replyId: previous.replyId,
    replyOrder: previous.replyOrder,
    shownItems: items.data.map(({ id, type, name }) => ({ id, type, name })),
  };
}

// A catalog search can precede booking intent. Carry an explicitly stated package
// ceiling into the first draft only when the delivered search used the same amount.
export function previousPackageBudget(
  search: Awaited<ReturnType<typeof buildPreviousCatalogSearchContext>>,
  history: ReadonlyArray<{ id: string; body: string }>,
) {
  const question = history.at(-3);

  if (
    !search ||
    !question ||
    search.input.catalogType !== "package" ||
    search.triggerMessageId !== question.id ||
    search.replyId !== history.at(-2)?.id ||
    search.input.maxPricePesos == null
  )
    return undefined;

  const scope = /\b(?:package\s+budget|budget\s+for\s+(?:the\s+)?package)\b/i;
  const negated = /\b(?:not|no|without|except|isn.t)\b/i;
  const revised =
    /\b(?:not|no|without|ignore|forget|clear|remove|change|instead|budget)\b/i;

  if (
    !scope.test(question.body) ||
    negated.test(question.body) ||
    revised.test(history.at(-1)?.body ?? "")
  )
    return undefined;

  const amounts = [
    ...question.body.matchAll(/(?:PHP|₱)\s*([\d,]+(?:\.\d+)?)\s*(k)?\b/gi),
  ];

  if (amounts.length !== 1) return undefined;

  const [literal, digits, thousands] = amounts[0]!;
  const pesos = Number(digits!.replaceAll(",", "")) * (thousands ? 1000 : 1);

  if (pesos !== search.input.maxPricePesos) return undefined;

  return `Package budget up to ${literal.trim()}`;
}

export async function buildPreviousCatalogItemContext({
  db,
  conversationId,
  customerMessageId,
}: {
  db: Kysely<DB>;
  conversationId: string;
  customerMessageId: string;
}) {
  const previous = await getLastCatalogToolCallData(db, {
    conversationId,
    customerMessageId,
    toolName: "getPublicCatalogItem",
  });

  if (!previous) return undefined;

  const input = getPublicCatalogItemInputSchema.safeParse(previous.input);
  const output = z
    .object({
      nextCursor: z.string().min(1).max(MAX_CURSOR_LENGTH).nullable(),
    })
    .safeParse(previous.output);

  if (!input.success || !output.success) return undefined;

  return { input: input.data, nextCursor: output.data.nextCursor };
}

export async function buildAssistantContext({
  db,
  customerId,
  bookingRequestId,
}: {
  db: Kysely<DB>;
  customerId: string;
  bookingRequestId: string | null;
}) {
  const booking = bookingRequestId
    ? await getBookingRequestService(db, bookingRequestId, customerId)
    : null;

  if (bookingRequestId && !booking)
    throw new Error("Booking request not found");

  return {
    currentDateTime: new Date().toISOString(),
    timeZone: booking?.timeZone ?? "Asia/Manila",
    bookingRequest: booking
      ? {
          reference: booking.reference,
          status: booking.status,
          eventType: booking.eventType,
          guestCount: booking.guestCount,
          timeZone: booking.timeZone,
          requestedDays:
            booking.requestedDays?.map((day) => ({
              date: day.date,
              startsAt: day.startsAt,
              endsAt: day.endsAt,
              operationalSchedule: day.operationalSchedule
                ? {
                    day: day.operationalSchedule.day,
                    startsAt: day.operationalSchedule.startsAt,
                    endsAt: day.operationalSchedule.endsAt,
                    timeZone: day.operationalSchedule.timeZone,
                    status: day.operationalSchedule.status,
                  }
                : null,
            })) ?? null,
          ...(booking.requestedDays === null
            ? {
                preferredDate: booking.preferredDate,
                startsAt: booking.startsAt,
                endsAt: booking.endsAt,
              }
            : {}),
          preferredVenueLocation: booking.preferredVenueLocation,
          specialRequests: booking.specialRequests,
        }
      : null,
  };
}
