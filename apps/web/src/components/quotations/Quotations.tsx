import "../../styles/booking-requests/booking-request.css";
import "../../styles/quotations/quotations.css";
import type {
  Quotation,
  QuotationItem,
  QuotationStatus,
} from "@event-management/contracts/quotations";
import { useEffect, useId, useRef, useState } from "react";
import {
  Badge,
  Button,
  Pagination,
  useNotifications,
} from "@event-management/ui";
import { usePagination } from "../../lib/pagination/use-pagination";
import { useRequestGeneration } from "../../lib/pagination/use-request-generation";
import {
  formatPesosFromMinor,
  formatSignedPesosFromMinor,
} from "../../lib/utils/formatting/money";
import { formatEnPhDateTime } from "../../lib/utils/formatting/dates";
import {
  getQuotation,
  getQuotations,
} from "../../lib/data/quotations/quotations";
import {
  getAdminBookingRequest,
  type BookingRequest,
  type BookingStatus,
} from "../../lib/data/booking-requests/requests";
import { QuotationComposer } from "./QuotationComposer";

type AddonItem = Extract<QuotationItem, { addon: object }>;

function addonDescription(line: AddonItem) {
  if (line.addon.requiresRemoval === "included")
    return "Now included in package · remove this add-on";

  if (line.addon.requiresRemoval === "archived")
    return "Service archived · remove this add-on";

  const hours = line.addon.totalHours ?? line.addon.hours;

  if (hours == null) return "Hours open";

  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

const formatWhen = (value: string) => formatEnPhDateTime(new Date(value));

const statusLabel: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  superseded: "Superseded",
};

const statusTone: Record<QuotationStatus, "warning" | "info" | "neutral"> = {
  draft: "warning",
  sent: "info",
  superseded: "neutral",
};

function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}

function readingIntro(quotation: Quotation) {
  if (quotation.status === "sent" && quotation.sentAt) {
    return `Version ${quotation.version} was sent on ${formatWhen(quotation.sentAt)}.`;
  }

  if (quotation.status === "superseded" && quotation.supersededAt) {
    return quotation.sentAt
      ? `Sent on ${formatWhen(quotation.sentAt)}. Replaced by a newer version.`
      : "Draft replaced by a newer version.";
  }

  return `Version ${quotation.version}.`;
}

export function QuotationSummaryRead({
  quotation,
  current = false,
}: {
  quotation: Quotation;
  current?: boolean;
}) {
  const currentFallback = current && quotation.status === "superseded";

  return (
    <div className="quotation-offer">
      <div className="quotation-offer-hero">
        <div>
          <p className="quotation-lede">
            Offer total · Version {quotation.version}
          </p>
          <strong className="quotation-hero-total">
            {quotation.items.some(
              (item) =>
                item.amountMinor === null || item.addon?.requiresRemoval,
            )
              ? "Incomplete"
              : formatPesosFromMinor(quotation.totalAmountMinor)}
          </strong>
        </div>
        {currentFallback ? (
          <Badge tone="info">Current offer</Badge>
        ) : (
          <QuotationStatusBadge status={quotation.status} />
        )}
      </div>
      <p className="quotation-lede">
        {currentFallback && quotation.sentAt
          ? `Version ${quotation.version} was sent on ${formatWhen(quotation.sentAt)}.`
          : readingIntro(quotation)}
      </p>
      {quotation.revisionReason && (
        <p className="quotation-meta">
          Revision note: {quotation.revisionReason}
        </p>
      )}
      <div className="quotation-summary-lines">
        <div className="quotation-summary-line">
          <div>
            <b>Package base</b>
            <span className="quotation-item-note">Included</span>
          </div>
          <b>{formatPesosFromMinor(quotation.baseAmountMinor)}</b>
        </div>
        {quotation.items.map((line) => (
          <div className="quotation-summary-line" key={line.id}>
            <div>
              <b>{line.description || "Untitled adjustment"}</b>
              <span className="quotation-item-note">
                {line.addon
                  ? addonDescription(line)
                  : line.direction === "deduct"
                    ? "Takes off the total"
                    : "Adds to the total"}
              </span>
            </div>
            <b
              className={
                line.direction === "deduct"
                  ? "quotation-amount-deduct"
                  : undefined
              }
            >
              {line.amountMinor === null
                ? "Incomplete"
                : formatSignedPesosFromMinor(
                    line.direction === "deduct"
                      ? -line.amountMinor
                      : line.amountMinor,
                  )}
            </b>
          </div>
        ))}
      </div>
      <p className="quotation-fine">
        This offer does not confirm the booking or reserve the date.
      </p>
    </div>
  );
}

type QuotationsProps = {
  bookingId?: string;
  admin: boolean;
  quotationId?: string;
  bookingStatus?: BookingStatus;
  onBookingChanged?: (booking: BookingRequest) => void;
  proposalAvailable?: boolean;
};

export function Quotations(props: QuotationsProps) {
  const scope = JSON.stringify([
    props.bookingId,
    props.admin,
    props.quotationId,
  ]);

  return <QuotationsView key={scope} {...props} />;
}

function QuotationsView({
  bookingId,
  admin,
  quotationId,
  bookingStatus,
  onBookingChanged,
  proposalAvailable = true,
}: QuotationsProps) {
  const { notifyError } = useNotifications();
  const [loadedStatus, setLoadedStatus] = useState<{
    value: BookingStatus;
    previous: BookingStatus | undefined;
  }>();
  const [bookingError, setBookingError] = useState("");
  const [refreshingBooking, setRefreshingBooking] = useState(false);
  const [composing, setComposing] = useState(false);
  const [page, setPage] = useState<Awaited<ReturnType<typeof getQuotations>>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );
  const [composerBusy, setComposerBusy] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLElement>(null);
  const historyHeadingId = useId();
  const generation = useRequestGeneration();
  const bookingGeneration = useRequestGeneration();
  const pagination = usePagination(bookingId ?? "");
  const status =
    loadedStatus && loadedStatus.previous === bookingStatus
      ? loadedStatus.value
      : bookingStatus;
  const closed =
    status === "declined" || status === "cancelled" || status === "finished";
  const canWrite =
    admin &&
    !!bookingId &&
    !quotationId &&
    (status === "under_review" ||
      status === "needs_details" ||
      status === "accepted");

  async function loadBooking() {
    if (!admin || !bookingId) return;

    const ticket = bookingGeneration.bump();
    setRefreshingBooking(true);
    setBookingError("");

    try {
      const { bookingRequest } = await getAdminBookingRequest(bookingId);

      if (bookingGeneration.isCurrent(ticket)) {
        setLoadedStatus({
          value: bookingRequest.status,
          previous: bookingStatus,
        });
        onBookingChanged?.(bookingRequest);
      }
    } catch (cause) {
      if (bookingGeneration.isCurrent(ticket)) {
        setBookingError(notifyError(cause, "Unable to load the booking."));
      }

      throw cause;
    } finally {
      if (bookingGeneration.isCurrent(ticket)) setRefreshingBooking(false);
    }
  }

  useEffect(() => {
    if (admin && bookingId && bookingStatus === undefined)
      void loadBooking().catch(() => {});

    return () => {
      bookingGeneration.bump();
    };
  }, [bookingStatus]);

  useEffect(() => {
    if (!canWrite) {
      setComposing(false);
      setComposerBusy(false);
    }
  }, [canWrite]);

  async function load(cursor = pagination.cursor) {
    const ticket = generation.bump();
    setLoading(true);
    setError("");

    try {
      const result =
        quotationId && !admin
          ? await getQuotation(quotationId).then(({ quotation }) => ({
              quotations: [quotation],
              currentOffer: quotation,
              nextCursor: null,
            }))
          : bookingId
            ? await getQuotations(bookingId, admin, { cursor, quotationId })
            : { quotations: [], currentOffer: null, nextCursor: null };

      if (generation.isCurrent(ticket)) setPage(result);
    } catch (cause) {
      if (generation.isCurrent(ticket))
        setError(notifyError(cause, "Unable to load quotations."));
    } finally {
      if (generation.isCurrent(ticket)) setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    return () => {
      generation.bump();
    };
  }, [pagination.cursor]);

  const currentOffer = quotationId
    ? page?.quotations.find((quote) => quote.id === quotationId)
    : page?.currentOffer;

  const earlierVersions = quotationId
    ? []
    : (page?.quotations ?? []).filter(
        (quote) => quote.id !== currentOffer?.id && quote.sentAt,
      );

  const nextCursor = page?.nextCursor ?? null;

  function closeComposer() {
    setComposing(false);
    setComposerBusy(false);
    window.requestAnimationFrame(() =>
      (opener.current ?? heading.current)?.focus(),
    );
  }

  function showSent(quotation: Quotation) {
    if (quotation.status === "sent")
      setPage((current) => ({
        currentOffer: quotation,
        nextCursor: current?.nextCursor ?? null,
        quotations: [
          quotation,
          ...(current?.quotations ?? [])
            .filter((previous) => previous.id !== quotation.id)
            .map<Quotation>((previous) =>
              previous.id === quotation.previousQuotationId &&
              previous.status === "sent"
                ? {
                    ...previous,
                    status: "superseded",
                    supersededAt: quotation.sentAt,
                  }
                : previous,
            ),
        ],
      }));

    closeComposer();

    if (pagination.page !== 1) pagination.reset();
    else void load();
  }

  return (
    <section
      ref={heading}
      tabIndex={-1}
      className="quotation-builder"
      aria-label="Quotations"
    >
      {admin && closed && (
        <p>This request is {status}. Packages and quotations are read-only.</p>
      )}
      {admin && bookingError && (
        <p role="alert">
          {bookingError}{" "}
          <Button
            variant="secondary"
            pending={refreshingBooking}
            onClick={() => void loadBooking().catch(() => {})}
          >
            Refresh booking
          </Button>
        </p>
      )}
      {admin && quotationId && bookingId && (
        <p className="quotation-meta">
          <a href={`/app/bookings/${encodeURIComponent(bookingId)}`}>
            Open booking quotations to prepare an offer
          </a>
        </p>
      )}
      {loading && <p role="status">Loading quotations…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" onClick={() => void load()}>
            Refresh quotations
          </Button>
        </p>
      )}

      {currentOffer && (
        <div className="quotation-stack">
          <QuotationSummaryRead
            quotation={currentOffer}
            current={!quotationId}
          />
          {!admin && (
            <p className="quotation-lede">Discuss this offer in Messages.</p>
          )}
        </div>
      )}
      {page &&
        !currentOffer &&
        !loading &&
        !error &&
        !composing &&
        (admin ? (
          <section className="quotation-empty">
            <h2>
              {quotationId ? "Quotation unavailable" : "No quotation yet"}
            </h2>
            {canWrite && !proposalAvailable && (
              <p>Prepare or choose a package before preparing a quotation.</p>
            )}
          </section>
        ) : (
          <p className="quotation-lede">No quotations yet.</p>
        ))}

      {canWrite && page && proposalAvailable && !composing && (
        <div className="quotation-actions quotation-actions-start">
          <Button
            ref={opener}
            icon={currentOffer ? "refresh" : "clipboard"}
            onClick={() => setComposing(true)}
          >
            {currentOffer ? "Revise this offer" : "Prepare quotation"}
          </Button>
        </div>
      )}

      {canWrite && bookingId && composing && (
        <QuotationComposer
          bookingId={bookingId}
          currentOffer={currentOffer ?? null}
          onCancel={closeComposer}
          onSent={showSent}
          onBusyChange={setComposerBusy}
          onRefresh={async () => {
            await loadBooking();
            await load();
          }}
          onOfferChanged={() => void load()}
        />
      )}

      {(earlierVersions.length > 0 || pagination.page > 1 || !!nextCursor) && (
        <section
          className="quotation-history"
          aria-labelledby={historyHeadingId}
        >
          <h2 id={historyHeadingId}>Earlier versions</h2>
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
                      Sent {formatWhen(quotation.sentAt ?? quotation.createdAt)}
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
          <Pagination
            page={pagination.page}
            hasNextPage={!!nextCursor}
            onPrevious={pagination.previous}
            onNext={() => pagination.next(nextCursor)}
            pending={loading || composerBusy}
            label="Quotation history"
          />
        </section>
      )}
    </section>
  );
}
