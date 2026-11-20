import { useEffect, useRef, useState } from "react";
import type {
  Quotation,
  QuotationItem,
} from "@event-management/contracts/quotations";
import { useNotifications } from "@event-management/ui";
import {
  getQuotation,
  getQuotations,
} from "../../lib/data/quotations/quotations";
import { usePagination } from "../../lib/pagination/use-pagination";
import { useRequestGeneration } from "../../lib/pagination/use-request-generation";

export function useQuotationsData({
  bookingId,
  admin,
  quotationId,
  historyLimit,
}: {
  bookingId?: string;
  admin: boolean;
  quotationId?: string;
  historyLimit?: number;
}) {
  const { notifyError } = useNotifications();
  const generation = useRequestGeneration();
  const [rows, setRows] = useState<Quotation[]>([]);
  const [draft, setDraft] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const draftRef = useRef(draft);
  const [pendingItem, setPendingItem] = useState<QuotationItem | null>(null);
  const [revisingOffer, setRevisingOffer] = useState<Quotation | null>(null);
  const [loadedPageKey, setLoadedPageKey] = useState("");
  const [loadedScope, setLoadedScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offer, setOffer] = useState<Quotation | null>(null);
  const [previousDraftVersion, setPreviousDraftVersion] = useState<
    number | null
  >(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const identity = JSON.stringify([
    bookingId ?? null,
    admin,
    quotationId ?? null,
  ]);
  const pagination = usePagination(identity);
  const pageRequest = useRef(0);
  const currentPageKey = JSON.stringify([
    bookingId ?? null,
    admin,
    quotationId ?? null,
    pagination.cursor ?? null,
  ]);
  const pageKeyRef = useRef(currentPageKey);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );

  draftRef.current = draft;
  pageKeyRef.current = currentPageKey;

  async function load(cursor = pagination.cursor) {
    const currentGeneration = generation.current();
    const sequence = ++pageRequest.current;
    const key = JSON.stringify([
      bookingId ?? null,
      admin,
      quotationId ?? null,
      cursor ?? null,
    ]);

    setLoading(true);
    setError("");

    try {
      const result =
        quotationId && !admin
          ? (() =>
              getQuotation(quotationId).then(({ quotation }) => ({
                quotations: [quotation],
                nextCursor: null,
                currentDraft: null,
                currentOffer:
                  quotation.status === "sent" || quotation.status === "accepted"
                    ? quotation
                    : null,
                previousDraftVersion: null,
              })))()
          : bookingId
            ? await getQuotations(bookingId, admin, {
                cursor,
                quotationId,
                limit: historyLimit,
              })
            : {
                quotations: [],
                nextCursor: null,
                currentDraft: null,
                currentOffer: null,
                previousDraftVersion: null,
              };

      const resolved = await result;

      if (
        !generation.isCurrent(currentGeneration) ||
        sequence !== pageRequest.current ||
        pageKeyRef.current !== key
      )
        return;

      setRows(resolved.quotations);
      setLoadedPageKey(key);
      setLoadedScope(identity);
      setNextCursor(resolved.nextCursor);
      setOffer(resolved.currentOffer);
      setPreviousDraftVersion(resolved.previousDraftVersion);

      if (
        draftRef.current?.id !== resolved.currentDraft?.id ||
        draftRef.current?.updatedAt !== resolved.currentDraft?.updatedAt
      )
        setItems(resolved.currentDraft?.items ?? []);

      setDraft(resolved.currentDraft);

      return true;
    } catch (cause) {
      if (
        !generation.isCurrent(currentGeneration) ||
        sequence !== pageRequest.current ||
        pageKeyRef.current !== key
      )
        return;

      setError(notifyError(cause, "Unable to load quotations."));
    } finally {
      if (
        generation.isCurrent(currentGeneration) &&
        sequence === pageRequest.current &&
        pageKeyRef.current === key
      )
        setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    return () => {
      pageRequest.current++;
    };
  }, [bookingId, admin, quotationId, pagination.cursor]);

  return {
    rows,
    setRows,
    draft,
    setDraft,
    items,
    setItems,
    pendingItem,
    setPendingItem,
    revisingOffer,
    setRevisingOffer,
    loadedPageKey,
    loadedScope,
    loading,
    busy,
    setBusy,
    error,
    setError,
    offer,
    setOffer,
    previousDraftVersion,
    nextCursor,
    pagination,
    currentPageKey,
    expandedHistoryId,
    setExpandedHistoryId,
    load,
    identity,
  };
}
