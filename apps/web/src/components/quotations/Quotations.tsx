import "../../styles/booking-requests/booking-request.css";
import {
  MAX_QUOTATION_ITEMS,
  MAX_QUOTATION_DESCRIPTION_LENGTH,
  MAX_QUOTATION_AMOUNT_MINOR,
} from "@event-management/contracts/quotations";
import type {
  Quotation,
  QuotationItem,
  QuotationStatus,
} from "@event-management/contracts/quotations";
import { usePagination } from "../../lib/pagination/use-pagination";
import { useRequestGeneration } from "../../lib/pagination/use-request-generation";
import {
  centavosToPesos,
  formatPesosFromMinor,
  formatSignedPesosFromMinor,
  pesosToCentavos,
} from "../../lib/utils/formatting/money";
import { formatEnPhDateTime } from "../../lib/utils/formatting/dates";
import {
  getAdminServices,
  type AdminService,
} from "../../lib/data/catalog/services";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Input,
  Pagination,
  Select,
  useNotifications,
} from "@event-management/ui";
import {
  createQuotation,
  getQuotation,
  getQuotations,
  reviseQuotation,
  saveQuotation,
  sendQuotation,
} from "../../lib/data/quotations/quotations";
import {
  getAdminBookingRequest,
  type BookingStatus,
} from "../../lib/data/booking-requests/requests";
import { ApiError } from "../../lib/http/request";

const formatWhen = (value: string) => formatEnPhDateTime(new Date(value));

const statusLabel: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  superseded: "Replaced",
};

const statusTone: Record<
  QuotationStatus,
  "warning" | "info" | "success" | "neutral"
> = {
  draft: "warning",
  sent: "info",
  accepted: "success",
  superseded: "neutral",
};

function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}

export function QuotationSummaryRead({ quotation }: { quotation: Quotation }) {
  return (
    <div className="quotation-offer">
      <div className="quotation-offer-hero">
        <div className="quotation-offer-hero-left">
          <span className="quotation-offer-label">Offer total</span>
          <strong className="quotation-hero-total">
            {formatPesosFromMinor(quotation.totalAmountMinor)}
          </strong>
          <span className="quotation-offer-meta">
            {quotation.sentAt
              ? `v${quotation.version} · Sent ${formatWhen(quotation.sentAt)}`
              : `v${quotation.version} · Not yet sent`}
          </span>
        </div>
        <QuotationStatusBadge status={quotation.status} />
      </div>
      {quotation.revisionReason && quotation.revisionReason !== "Revised" && (
        <p className="quotation-revision-note">
          Revision note: {quotation.revisionReason}
        </p>
      )}
      <div className="quotation-receipt">
        <div className="quotation-receipt-row">
          <span>Package base</span>
          <span>{formatPesosFromMinor(quotation.baseAmountMinor)}</span>
        </div>
        {quotation.items.length > 0 && (
          <span className="quotation-receipt-section-label">Adjustments</span>
        )}
        {quotation.items.map((line) => (
          <div className="quotation-receipt-row" key={line.id}>
            <span>{line.description || "Untitled adjustment"}</span>
            <span
              className={
                line.direction === "deduct"
                  ? "quotation-amount-deduct"
                  : "quotation-amount-add"
              }
            >
              {formatSignedPesosFromMinor(
                line.direction === "deduct"
                  ? -line.amountMinor
                  : line.amountMinor,
              )}
            </span>
          </div>
        ))}
        <div className="quotation-receipt-row quotation-receipt-total">
          <span>Total</span>
          <span>{formatPesosFromMinor(quotation.totalAmountMinor)}</span>
        </div>
      </div>
      <p className="quotation-fine">
        This offer does not confirm the booking or reserve the date.
      </p>
    </div>
  );
}

function QuotationMathBox({
  baseAmountMinor,
  items,
  totalMinor,
}: {
  baseAmountMinor: number;
  items: QuotationItem[];
  totalMinor: number;
}) {
  return (
    <>
      <div
        className="quotation-receipt quotation-receipt-standalone"
        aria-live="polite"
      >
        <div className="quotation-receipt-row">
          <span>Package base</span>
          <span>{formatPesosFromMinor(baseAmountMinor)}</span>
        </div>
        {items.length > 0 && (
          <span className="quotation-receipt-section-label">Adjustments</span>
        )}
        {items.map((line) => (
          <div className="quotation-receipt-row" key={line.id}>
            <span>{line.description || <em>Untitled adjustment</em>}</span>
            <span
              className={
                line.direction === "deduct"
                  ? "quotation-amount-deduct"
                  : "quotation-amount-add"
              }
            >
              {formatSignedPesosFromMinor(
                line.direction === "deduct"
                  ? -line.amountMinor
                  : line.amountMinor,
              )}
            </span>
          </div>
        ))}
        <div className="quotation-receipt-row quotation-receipt-total">
          <span>Total</span>
          <span>{formatPesosFromMinor(totalMinor)}</span>
        </div>
      </div>
      {totalMinor < 0 && (
        <p className="quotation-negative-warn" role="alert">
          The total is below zero. Raise an amount or remove a deduction before
          sending.
        </p>
      )}
    </>
  );
}

function QuotationAdjustmentReadRow({
  line,
  index,
  services,
  busy,
  onRemove,
}: {
  line: QuotationItem;
  index: number;
  services: AdminService[];
  busy: boolean;
  onRemove: () => void;
}) {
  const serviceName =
    services.find((s) => s.id === line.serviceId)?.name ?? null;
  const isDeduct = line.direction === "deduct";

  return (
    <div className="quotation-adj-card">
      <div className="quotation-adj-card-main">
        <div className="quotation-adj-card-desc-row">
          <span
            className={`quotation-adj-card-dir ${isDeduct ? "quotation-adj-card-dir--deduct" : "quotation-adj-card-dir--add"}`}
          >
            {isDeduct ? "Deduct" : "Add"}
          </span>
          <span className="quotation-adj-card-desc">
            {line.description || <em>No description</em>}
          </span>
        </div>
        {serviceName && (
          <span className="quotation-adj-card-service">{serviceName}</span>
        )}
      </div>
      <div className="quotation-adj-card-right">
        <span
          className={`quotation-adj-card-amount ${isDeduct ? "quotation-amount-deduct" : "quotation-amount-add"}`}
        >
          {isDeduct ? "−" : "+"}&nbsp;{formatPesosFromMinor(line.amountMinor)}
        </span>
        <Button
          variant="link"
          size="small"
          disabled={busy}
          onClick={onRemove}
          aria-label={`Remove adjustment ${index + 1}`}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

export function Quotations({
  bookingId,
  admin,
  quotationId,
  bookingStatus,
  refreshBooking,
  proposalAvailable = true,
}: {
  bookingId?: string;
  admin: boolean;
  quotationId?: string;
  bookingStatus?: BookingStatus;
  refreshBooking?: () => Promise<void>;
  proposalAvailable?: boolean;
}) {
  const { notify, notifyError } = useNotifications();
  const bookingScope = JSON.stringify([bookingId, admin, quotationId]);
  const bookingScopeRef = useRef({ key: bookingScope, generation: 0 });

  if (bookingScopeRef.current.key !== bookingScope) {
    bookingScopeRef.current = {
      key: bookingScope,
      generation: bookingScopeRef.current.generation + 1,
    };
  }

  const mountedRef = useRef(false);
  const bookingRefreshSequence = useRef(0);
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [loadedBooking, setLoadedBooking] = useState<{
    id: string;
    status: BookingStatus;
    generation: number;
  } | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [needsBookingRefresh, setNeedsBookingRefresh] = useState(false);
  const [refreshingBooking, setRefreshingBooking] = useState(false);
  const status =
    bookingStatus ??
    (loadedBooking &&
    loadedBooking.id === bookingId &&
    loadedBooking.generation === bookingScopeRef.current.generation
      ? loadedBooking.status
      : undefined);
  const canWrite =
    admin &&
    !!bookingId &&
    !!status &&
    status !== "declined" &&
    status !== "cancelled" &&
    !needsBookingRefresh &&
    !refreshingBooking;
  const canWriteRef = useRef(canWrite);
  const eligibilityRef = useRef({ allowed: canWrite, generation: 0 });

  if (eligibilityRef.current.allowed !== canWrite) {
    eligibilityRef.current = {
      allowed: canWrite,
      generation: eligibilityRef.current.generation + 1,
    };
  }

  canWriteRef.current = canWrite;

  async function loadBooking() {
    if (!bookingId || !admin) return;

    const requestGeneration = bookingScopeRef.current.generation;
    const sequence = ++bookingRefreshSequence.current;

    const isCurrent = () =>
      mountedRef.current &&
      bookingScopeRef.current.generation === requestGeneration &&
      bookingRefreshSequence.current === sequence;

    canWriteRef.current = false;
    setNeedsBookingRefresh(true);
    setRefreshingBooking(true);
    setBookingError("");

    try {
      if (refreshBooking) await refreshBooking();
      else {
        const result = await getAdminBookingRequest(bookingId);

        if (!isCurrent()) return;

        setLoadedBooking({
          id: bookingId,
          status: result.bookingRequest.status,
          generation: requestGeneration,
        });
      }

      if (!isCurrent()) return;

      if ((await load()) && isCurrent()) setNeedsBookingRefresh(false);
    } catch (cause) {
      if (!isCurrent()) return;

      setBookingError(notifyError(cause, "Unable to refresh the booking."));
      setNeedsBookingRefresh(true);
    } finally {
      if (isCurrent()) setRefreshingBooking(false);
    }
  }
  useEffect(() => {
    setNeedsBookingRefresh(false);
    setRefreshingBooking(false);
    setBookingError("");
  }, [bookingScope]);
  useEffect(() => {
    if (!admin || bookingStatus !== undefined || !bookingId) return;

    let active = true;
    const requestGeneration = bookingScopeRef.current.generation;
    setLoadedBooking(null);
    setBookingError("");
    void getAdminBookingRequest(bookingId)
      .then((result) => {
        if (active)
          setLoadedBooking({
            id: bookingId,
            status: result.bookingRequest.status,
            generation: requestGeneration,
          });
      })
      .catch((cause) => {
        if (active)
          setBookingError(notifyError(cause, "Unable to load the booking."));
      });

    return () => {
      active = false;
    };
  }, [admin, bookingId, bookingStatus, bookingScope]);

  const generation = useRequestGeneration();
  const [services, setServices] = useState<AdminService[]>([]);
  const [serviceError, setServiceError] = useState("");
  const [serviceCursor, setServiceCursor] = useState<string | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);

  async function loadServices(cursor?: string) {
    const current = generation.current();
    setServiceLoading(true);

    try {
      const result = await getAdminServices({ cursor });

      if (!generation.isCurrent(current)) return;

      setServices((previous) =>
        cursor ? [...previous, ...result.services] : result.services,
      );
      setServiceCursor(result.nextCursor);
      setServiceError("");
    } catch (cause) {
      if (!generation.isCurrent(current)) return;

      setServiceError(notifyError(cause, "Unable to load services."));
    } finally {
      if (generation.isCurrent(current)) setServiceLoading(false);
    }
  }

  const [rows, setRows] = useState<Quotation[]>([]),
    [draft, setDraft] = useState<Quotation | null>(null),
    [items, setItems] = useState<QuotationItem[]>([]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [pendingItem, setPendingItem] = useState<QuotationItem | null>(null);
  const [revisingOffer, setRevisingOffer] = useState<Quotation | null>(null);
  const [loadedPageKey, setLoadedPageKey] = useState("");
  const [loadedScope, setLoadedScope] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
  pageKeyRef.current = currentPageKey;
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );

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
            ? await getQuotations(bookingId, admin, { cursor, quotationId })
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
  useEffect(() => {
    if (admin) void loadServices();

    return () => {
      generation.bump();
    };
  }, [bookingId, admin, quotationId]);

  useEffect(() => {
    setBusy(false);
  }, [bookingScope]);

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

  const editorTotal =
    (draft?.baseAmountMinor ?? 0) +
    items.reduce(
      (sum, line) =>
        sum + (line.direction === "add" ? line.amountMinor : -line.amountMinor),
      0,
    );

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.version - a.version),
    [rows],
  );

  const currentOffer = offer;

  const earlierVersions =
    loadedPageKey === currentPageKey
      ? sorted.filter((q) => q.status === "superseded")
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
      {admin && (status === "declined" || status === "cancelled") && (
        <p>This request is {status}. Packages and quotations are read-only.</p>
      )}
      {admin && (bookingError || needsBookingRefresh) && (
        <p role="alert">
          {bookingError || "Refresh the booking before retrying."}{" "}
          <Button
            variant="secondary"
            disabled={refreshingBooking}
            onClick={() => void loadBooking()}
          >
            Refresh booking
          </Button>
        </p>
      )}
      {admin && quotationId && bookingId && (
        <p className="quotation-meta">
          <a href={`/app/bookings/${encodeURIComponent(bookingId)}`}>
            Open booking quotations to continue editing revisions
          </a>
        </p>
      )}

      {loading && <p role="status">Loading quotations…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh quotations
          </Button>
        </p>
      )}

      {adminEmpty && (
        <section className="quotation-empty">
          <h2>No quotation yet</h2>
          {canWrite && !proposalAvailable && (
            <p>Prepare or choose a package before creating a quotation.</p>
          )}
          {canWrite && proposalAvailable && (
            <>
              <p className="quotation-lede">
                Create a draft from the current package price. You can add
                adjustments before sending it.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void action(
                    "Quotation draft created.",
                    async (canContinue) => {
                      const booking = await getAdminBookingRequest(bookingId);

                      if (!canContinue()) return;

                      if (
                        !canWriteRef.current ||
                        ["declined", "cancelled"].includes(
                          booking.bookingRequest.status,
                        )
                      ) {
                        canWriteRef.current = false;
                        setNeedsBookingRefresh(true);
                        throw new Error("Refresh the booking before retrying.");
                      }

                      await createQuotation(
                        bookingId,
                        booking.bookingRequest.updatedAt,
                      );
                    },
                  )
                }
              >
                Create draft
              </Button>
            </>
          )}
        </section>
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

      {admin && (draft || revisingOffer) && canWrite && (
        <fieldset className="quotation-stack" disabled={busy || !canWrite}>
          <div className="quotation-offer-head">
            <div>
              <h2 className="quotation-offer-title">
                Version{" "}
                {revisingOffer ? revisingOffer.version + 1 : draft!.version}
              </h2>
              <div className="quotation-meta-stack">
                {revisingOffer && (
                  <p className="quotation-meta">
                    Revision of version {revisingOffer.version}.
                  </p>
                )}
                {!revisingOffer && previousDraftVersion != null && (
                  <p className="quotation-meta">
                    Draft revision of version {previousDraftVersion}.
                  </p>
                )}
              </div>
            </div>
            <QuotationStatusBadge status="draft" />
          </div>

          <div className="quotation-adj-section">
            <div className="quotation-adj-section-header">
              <span>Adjustments</span>
            </div>

            {items.length > 0 && (
              <div className="quotation-adj-list">
                {items.map((line, index) => (
                  <QuotationAdjustmentReadRow
                    key={line.id}
                    line={line}
                    index={index}
                    services={services}
                    busy={busy}
                    onRemove={() =>
                      canWriteRef.current &&
                      setItems((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  />
                ))}
              </div>
            )}

            {pendingItem && (
              <div className="quotation-adj-pending">
                <div className="quotation-adj-pending-fields">
                  <div className="quotation-adj-pending-field quotation-adj-pending-field--wide">
                    <label
                      htmlFor="adj-pending-desc"
                      className="quotation-adj-pending-label"
                    >
                      Description
                    </label>
                    <Input
                      id="adj-pending-desc"
                      aria-label="New adjustment description"
                      placeholder="e.g. Extra setup fee"
                      autoFocus
                      maxLength={MAX_QUOTATION_DESCRIPTION_LENGTH}
                      value={pendingItem.description}
                      onChange={(event) =>
                        setPendingItem((p) =>
                          p ? { ...p, description: event.target.value } : p,
                        )
                      }
                    />
                  </div>
                  <div className="quotation-adj-pending-field">
                    <label
                      htmlFor="adj-pending-service"
                      className="quotation-adj-pending-label"
                    >
                      Service
                    </label>
                    <Select
                      id="adj-pending-service"
                      value={pendingItem.serviceId ?? ""}
                      onChange={(event) =>
                        setPendingItem((p) =>
                          p
                            ? { ...p, serviceId: event.target.value || null }
                            : p,
                        )
                      }
                    >
                      <option value="">No service</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                          {service.archivedAt ? " (archived)" : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="quotation-adj-pending-field">
                    <label
                      htmlFor="adj-pending-dir"
                      className="quotation-adj-pending-label"
                    >
                      Effect
                    </label>
                    <Select
                      id="adj-pending-dir"
                      value={pendingItem.direction}
                      onChange={(event) =>
                        setPendingItem((p) =>
                          p
                            ? {
                                ...p,
                                direction:
                                  event.target.value === "deduct"
                                    ? "deduct"
                                    : "add",
                              }
                            : p,
                        )
                      }
                    >
                      <option value="add">+ Add</option>
                      <option value="deduct">− Deduct</option>
                    </Select>
                  </div>
                  <div className="quotation-adj-pending-field">
                    <label
                      htmlFor="adj-pending-amount"
                      className="quotation-adj-pending-label"
                    >
                      Amount (PHP)
                    </label>
                    <Input
                      id="adj-pending-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      max={centavosToPesos(MAX_QUOTATION_AMOUNT_MINOR)}
                      value={centavosToPesos(pendingItem.amountMinor) || ""}
                      onChange={(event) =>
                        setPendingItem((p) =>
                          p
                            ? {
                                ...p,
                                amountMinor: pesosToCentavos(
                                  Number(event.target.value),
                                ),
                              }
                            : p,
                        )
                      }
                    />
                  </div>
                </div>
                <div className="quotation-pending-actions">
                  {serviceCursor && (
                    <Button
                      variant="secondary"
                      disabled={serviceLoading}
                      onClick={() => void loadServices(serviceCursor)}
                      className="quotation-pending-refresh"
                    >
                      Refresh services
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => setPendingItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setItems((current) => [...current, pendingItem]);
                      setPendingItem(null);
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}

            {!pendingItem && (
              <div className="quotation-adj-section-footer">
                <Button
                  variant="secondary"
                  disabled={items.length >= MAX_QUOTATION_ITEMS}
                  onClick={() =>
                    setPendingItem({
                      id: crypto.randomUUID(),
                      direction: "add",
                      kind: "adjustment",
                      description: "",
                      amountMinor: 0,
                      serviceId: null,
                    })
                  }
                >
                  Add adjustment
                </Button>
              </div>
            )}
          </div>

          <QuotationMathBox
            baseAmountMinor={
              revisingOffer
                ? revisingOffer.baseAmountMinor
                : draft!.baseAmountMinor
            }
            items={items}
            totalMinor={editorTotal}
          />

          <p className="quotation-fine">
            This offer does not confirm the booking or reserve the date.
          </p>

          <div className="quotation-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (revisingOffer) {
                  setRevisingOffer(null);
                } else {
                  setDraft(null);
                  setOffer(draft!);
                }
                setItems([]);
                setPendingItem(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!canWriteRef.current) return;

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
                      ...current.map((q) =>
                        q.id === revisingOffer.id
                          ? { ...q, status: "superseded" as const }
                          : q,
                      ),
                      saved.quotation,
                    ]);
                    setOffer(saved.quotation);
                  } else {
                    const saved = await saveQuotation(
                      draft!.id,
                      draft!.updatedAt,
                      items,
                    );

                    notify("Adjustments saved.");
                    setRows((current) =>
                      current.map((q) =>
                        q.id === saved.quotation.id ? saved.quotation : q,
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
              }}
            >
              Save adjustments
            </Button>
          </div>
        </fieldset>
      )}

      {!draft && currentOffer && !revisingOffer && (
        <div className="quotation-stack">
          <QuotationSummaryRead quotation={currentOffer} />
          {!admin && (
            <p className="quotation-lede">Discuss this offer in Messages.</p>
          )}
          {admin && canWrite && (
            <div className="quotation-actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setRevisingOffer(currentOffer);
                  setItems(currentOffer.items);
                  setPendingItem(null);
                }}
              >
                Revise
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void action("Offer sent to chat.", async () => {
                    await sendQuotation(
                      currentOffer.id,
                      currentOffer.updatedAt,
                    );
                  })
                }
              >
                Send to chat
              </Button>
            </div>
          )}
        </div>
      )}

      {(earlierVersions.length > 0 || pagination.page > 1 || !!nextCursor) && (
        <section
          className="quotation-history"
          aria-labelledby="quotation-history-title"
        >
          <h2 id="quotation-history-title">Earlier versions</h2>
          {earlierVersions.map((quotation) => {
            const expanded = expandedHistoryId === quotation.id;

            return (
              <div key={quotation.id}>
                <Button
                  variant="plain"
                  className="quotation-history-item"
                  aria-expanded={expanded}
                  onClick={() =>
                    setExpandedHistoryId(expanded ? null : quotation.id)
                  }
                >
                  <span>
                    <strong>
                      Version {quotation.version} ·{" "}
                      {statusLabel[quotation.status]}
                    </strong>
                    <span>
                      {quotation.sentAt
                        ? `Sent ${formatWhen(quotation.sentAt)}`
                        : `Created ${formatWhen(quotation.createdAt)}`}
                    </span>
                  </span>
                  <b>{formatPesosFromMinor(quotation.totalAmountMinor)}</b>
                </Button>
                {expanded && (
                  <div className="quotation-history-body">
                    <QuotationSummaryRead quotation={quotation} />
                  </div>
                )}
              </div>
            );
          })}
          {!quotationId && (
            <Pagination
              page={pagination.page}
              hasNextPage={!!nextCursor}
              onPrevious={pagination.previous}
              onNext={() => pagination.next(nextCursor)}
              pending={loading || busy || loadedPageKey !== currentPageKey}
              label="Quotation history"
            />
          )}
        </section>
      )}
    </section>
  );
}
