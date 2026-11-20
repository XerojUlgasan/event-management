import "../../styles/booking-requests/booking-request.css";
import { useEffect, useMemo, useRef } from "react";
import type { QuotationItem } from "@event-management/contracts/quotations";
import { Button, useNotifications } from "@event-management/ui";
import {
  getAdminBookingRequest,
  type BookingStatus,
} from "../../lib/data/booking-requests/requests";
import {
  createQuotation,
  reviseQuotation,
  saveQuotation,
  sendQuotation,
  acceptQuotation,
  requestRevision,
} from "../../lib/data/quotations/quotations";
import { ApiError } from "../../lib/http/request";
import { QuotationDraftEditor } from "./QuotationDraftEditor";
import { QuotationEmptyState } from "./QuotationEmptyState";
import { QuotationHistory } from "./QuotationHistory";
import { QuotationNotices } from "./QuotationNotices";
import { QuotationOfferCard } from "./QuotationOfferCard";
import { QuotationSummaryRead } from "./QuotationSummaryRead";
import { useQuotationEligibility } from "./use-quotation-eligibility";
import { useQuotationServices } from "./use-quotation-services";
import { useQuotationsData } from "./use-quotations-data";

export function Quotations({
  bookingId,
  admin,
  quotationId,
  bookingStatus,
  refreshBooking,
  proposalAvailable = true,
  historyLimit,
}: {
  bookingId?: string;
  admin: boolean;
  quotationId?: string;
  bookingStatus?: BookingStatus;
  refreshBooking?: () => Promise<void>;
  proposalAvailable?: boolean;
  historyLimit?: number;
}) {
  const { notify, notifyError } = useNotifications();

  const loadRef = useRef<() => Promise<unknown>>(async () => undefined);

  const {
    status,
    canWrite,
    canWriteRef,
    eligibilityRef,
    mountedRef,
    bookingScopeRef,
    bookingError,
    needsBookingRefresh,
    setNeedsBookingRefresh,
    refreshingBooking,
    loadBooking,
  } = useQuotationEligibility({
    admin,
    bookingId,
    quotationId,
    bookingStatus,
    refreshBooking,
    load: () => loadRef.current(),
  });

  const data = useQuotationsData({
    bookingId,
    admin,
    quotationId,
    historyLimit,
  });
  loadRef.current = data.load;
  const {
    services,
    serviceError,
    serviceCursor,
    serviceLoading,
    loadServices,
  } = useQuotationServices({ admin, bookingId, quotationId });
  const {
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
  } = data;

  useEffect(() => {
    setBusy(false);
  }, [identity]);

  async function action(
    successMessage: string,
    fn: (canContinue: () => boolean) => Promise<unknown>,
  ) {
    if (!canWriteRef.current) return;

    const scopeGeneration = bookingScopeRef.current.generation;
    const eligibilityGeneration = eligibilityRef.current.generation;

    const isCurrent = () =>
      mountedRef.current &&
      bookingScopeRef.current.generation === scopeGeneration;

    const canContinue = () =>
      isCurrent() &&
      canWriteRef.current &&
      eligibilityRef.current.generation === eligibilityGeneration;

    setBusy(true);
    setError("");

    try {
      await fn(canContinue);

      if (!canContinue()) return;

      notify(successMessage);

      if (pagination.page !== 1) pagination.reset();
      else await load();
    } catch (cause) {
      if (!canContinue()) return;

      if (cause instanceof ApiError && cause.status === 409) {
        canWriteRef.current = false;
        setNeedsBookingRefresh(true);
      }

      setError(notifyError(cause, "Unable to update quotation."));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  function createDraft() {
    if (!bookingId) return;

    void action("Quotation draft created.", async (canContinue) => {
      const booking = await getAdminBookingRequest(bookingId);

      if (!canContinue()) return;

      if (
        !canWriteRef.current ||
        ["declined", "cancelled"].includes(booking.bookingRequest.status)
      ) {
        canWriteRef.current = false;
        setNeedsBookingRefresh(true);
        throw new Error("Refresh the booking before retrying.");
      }

      await createQuotation(bookingId, booking.bookingRequest.updatedAt);
    });
  }

  function sendOffer() {
    const target = offer ?? draft;
    if (!target) return;

    void action("Offer sent to chat.", async () => {
      await sendQuotation(target.id, target.updatedAt);
    });
  }

  function acceptOffer() {
    if (!offer) return;

    void action("Quotation accepted.", async () => {
      await acceptQuotation(offer.id, offer.updatedAt);
    });
  }

  function requestOfferRevision() {
    if (!offer) return;

    void action("Revision requested.", async () => {
      await requestRevision(offer.id, offer.updatedAt);
    });
  }

  async function saveDraft() {
    if (!canWriteRef.current || (!revisingOffer && !draft)) return;

    setBusy(true);
    setError("");

    try {
      if (revisingOffer) {
        const revised = await reviseQuotation(
          revisingOffer.id,
          revisingOffer.updatedAt,
          "Revised",
        );
        const saved = await saveQuotation(
          revised.quotation.id,
          revised.quotation.updatedAt,
          items,
        );

        notify("Revision saved.");
        setRevisingOffer(null);
        setItems([]);
        setPendingItem(null);
        setRows((current) => [
          ...current.map((quotation) =>
            quotation.id === revisingOffer.id
              ? { ...quotation, status: "superseded" as const }
              : quotation,
          ),
          saved.quotation,
        ]);
        setOffer(saved.quotation);
      } else {
        const saved = await saveQuotation(draft!.id, draft!.updatedAt, items);

        notify("Adjustments saved.");
        setRows((current) =>
          current.map((quotation) =>
            quotation.id === saved.quotation.id ? saved.quotation : quotation,
          ),
        );
        setDraft(null);
        setPendingItem(null);
        setOffer(saved.quotation);
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        canWriteRef.current = false;
        setNeedsBookingRefresh(true);
      }

      setError(notifyError(cause, "Unable to save."));
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    if (revisingOffer) setRevisingOffer(null);
    else if (draft) {
      setDraft(null);
      setOffer(draft);
    }

    setItems([]);
    setPendingItem(null);
  }

  function startRevision() {
    const target = offer ?? draft;
    if (!target) return;

    setRevisingOffer(target);
    setItems(target.items);
    setPendingItem(null);
  }

  function removeItem(index: number) {
    if (!canWriteRef.current) return;

    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function startAddAdjustment() {
    setPendingItem({
      id: crypto.randomUUID(),
      direction: "add",
      kind: "adjustment",
      description: "",
      amountMinor: 0,
      serviceId: null,
    });
  }

  function updatePending(patch: Partial<QuotationItem>) {
    setPendingItem((current) => (current ? { ...current, ...patch } : current));
  }

  function addPending() {
    if (!pendingItem) return;

    setItems((current) => [...current, pendingItem]);
    setPendingItem(null);
  }

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.version - a.version),
    [rows],
  );

  const earlierVersions =
    loadedPageKey === currentPageKey
      ? sorted.filter((quotation) => quotation.status === "superseded")
      : [];

  const adminEmpty =
    admin &&
    bookingId &&
    !quotationId &&
    !loading &&
    !error &&
    !draft &&
    rows.length === 0;

  if (loadedScope !== identity)
    return (
      <section className="quotation-builder" aria-label="Quotations">
        {error ? (
          <p role="alert">
            {error}{" "}
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </p>
        ) : (
          <p role="status">Loading quotations…</p>
        )}
      </section>
    );

  return (
    <section className="quotation-builder" aria-label="Quotations">
      <QuotationNotices
        admin={admin}
        status={status}
        bookingError={bookingError}
        needsBookingRefresh={needsBookingRefresh}
        refreshingBooking={refreshingBooking}
        onRefreshBooking={() => void loadBooking()}
        bookingId={bookingId}
        quotationId={quotationId}
        loading={loading}
        error={error}
        busy={busy}
        onReload={() => void load()}
      />

      {adminEmpty && (
        <QuotationEmptyState
          canWrite={canWrite}
          proposalAvailable={proposalAvailable}
          busy={busy}
          onCreateDraft={createDraft}
        />
      )}

      {!loading && !error && !admin && rows.length === 0 && (
        <p className="quotation-lede">No quotations yet.</p>
      )}

      {canWrite && draft && serviceError && (
        <p role="alert">
          {serviceError}{" "}
          <Button
            variant="secondary"
            onClick={() =>
              void loadServices(
                services.length ? (serviceCursor ?? undefined) : undefined,
              )
            }
          >
            Retry services
          </Button>
        </p>
      )}

      {admin && draft && !canWrite && (
        <QuotationSummaryRead quotation={draft} />
      )}

      {admin && draft && canWrite && !revisingOffer && (
        <QuotationOfferCard
          quotation={draft}
          admin={admin}
          canWrite={canWrite}
          busy={busy}
          onRevise={startRevision}
          onSend={sendOffer}
        />
      )}
      {admin && revisingOffer && canWrite && (
        <QuotationDraftEditor
          draft={draft}
          revisingOffer={revisingOffer}
          previousDraftVersion={previousDraftVersion}
          items={items}
          pendingItem={pendingItem}
          services={services}
          serviceCursor={serviceCursor}
          serviceLoading={serviceLoading}
          busy={busy}
          onRemoveItem={removeItem}
          onStartAdd={startAddAdjustment}
          onUpdatePending={updatePending}
          onCancelPending={() => setPendingItem(null)}
          onAddPending={addPending}
          onRefreshServices={(cursor) => void loadServices(cursor)}
          onCancel={cancelEdit}
          onSave={() => void saveDraft()}
        />
      )}

      {!draft && offer && !revisingOffer && (
        <QuotationOfferCard
          quotation={offer}
          admin={admin}
          canWrite={canWrite}
          busy={busy}
          onRevise={startRevision}
          onSend={sendOffer}
          onAccept={acceptOffer}
          onRequestRevision={requestOfferRevision}
        />
      )}

      <QuotationHistory
        quotations={earlierVersions}
        expandedId={expandedHistoryId}
        onToggle={(id) =>
          setExpandedHistoryId(expandedHistoryId === id ? null : id)
        }
        page={pagination.page}
        hasNextPage={!!nextCursor}
        onPrevious={pagination.previous}
        onNext={() => pagination.next(nextCursor)}
        pending={loading || busy || loadedPageKey !== currentPageKey}
        showPagination={!quotationId}
      />
    </section>
  );
}
