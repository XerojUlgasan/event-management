import "../../styles/booking-requests/booking-request.css";
import {
  MAX_QUOTATION_ITEMS,
  MAX_QUOTATION_DESCRIPTION_LENGTH,
  MAX_QUOTATION_REASON_LENGTH,
  MAX_QUOTATION_AMOUNT_MINOR,
} from "@event-management/contracts/quotations";
import type {
  Quotation,
  QuotationItem,
  QuotationStatus,
} from "@event-management/contracts/quotations";
import { usePagination } from "../../lib/pagination/use-pagination";
import {
  getAdminServices,
  type AdminService,
} from "../../lib/data/catalog/services";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  FormField,
  Input,
  Pagination,
  Select,
  Textarea,
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
import { getAdminBookingRequest } from "../../lib/data/booking-requests/requests";

const money = (amountMinor: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amountMinor / 100,
  );

const signedMoney = (amountMinor: number) => {
  const formatted = money(Math.abs(amountMinor));
  if (amountMinor > 0) return `+${formatted}`;
  if (amountMinor < 0) return `−${formatted}`;
  return formatted;
};

const formatWhen = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const statusLabel: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  superseded: "Superseded",
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

const kindLabels: Record<QuotationItem["kind"], string> = {
  addition: "Addition",
  deduction: "Deduction",
  substitution: "Substitution",
  adjustment: "Other adjustment",
};

function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}

function lineTotals(items: QuotationItem[]) {
  const additions = items
    .filter((line) => line.direction === "add")
    .reduce((sum, line) => sum + line.amountMinor, 0);
  const deductions = items
    .filter((line) => line.direction === "deduct")
    .reduce((sum, line) => sum + line.amountMinor, 0);
  return { additions, deductions };
}

function readingIntro(quotation: Quotation) {
  if (quotation.status === "accepted" && quotation.acceptedAt) {
    return `Version ${quotation.version} was accepted on ${formatWhen(quotation.acceptedAt)}.`;
  }
  if (quotation.status === "sent" && quotation.sentAt) {
    return `Version ${quotation.version} was sent on ${formatWhen(quotation.sentAt)}.`;
  }
  if (quotation.status === "superseded" && quotation.supersededAt) {
    return `Version ${quotation.version} was sent on ${quotation.sentAt ? formatWhen(quotation.sentAt) : "an earlier date"}. Replaced by a newer version.`;
  }
  return `Version ${quotation.version}.`;
}

export function QuotationSummaryRead({ quotation }: { quotation: Quotation }) {
  return (
    <div className="quotation-offer">
      <div className="quotation-offer-hero">
        <div>
          <p className="quotation-lede">
            Offer total · Version {quotation.version}
          </p>
          <strong className="quotation-hero-total">
            {money(quotation.totalAmountMinor)}
          </strong>
        </div>
        <QuotationStatusBadge status={quotation.status} />
      </div>
      <p className="quotation-lede">{readingIntro(quotation)}</p>
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
          <b>{money(quotation.baseAmountMinor)}</b>
        </div>
        {quotation.items.map((line) => (
          <div className="quotation-summary-line" key={line.id}>
            <div>
              <b>{line.description || "Untitled adjustment"}</b>
              <span className="quotation-item-note">
                {line.direction === "deduct"
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
              {signedMoney(
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

function QuotationMathBox({
  baseAmountMinor,
  items,
  totalMinor,
}: {
  baseAmountMinor: number;
  items: QuotationItem[];
  totalMinor: number;
}) {
  const { additions, deductions } = lineTotals(items);
  return (
    <>
      <div className="quotation-math" aria-live="polite">
        <div>
          <span>Package base</span>
          <span>{money(baseAmountMinor)}</span>
        </div>
        <div>
          <span>Additions</span>
          <span>{signedMoney(additions)}</span>
        </div>
        <div>
          <span>Deductions</span>
          <span className="quotation-amount-deduct">
            {signedMoney(-deductions)}
          </span>
        </div>
        <div className="quotation-math-grand">
          <span>Offer total</span>
          <span>{money(totalMinor)}</span>
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

function QuotationAdjustmentCard({
  line,
  index,
  services,
  busy,
  onChange,
  onRemove,
}: {
  line: QuotationItem;
  index: number;
  services: AdminService[];
  busy: boolean;
  onChange: (patch: Partial<QuotationItem>) => void;
  onRemove: () => void;
}) {
  return (
    <article className="quotation-adjustment">
      <div className="quotation-adjustment-head">
        <strong>Adjustment {index + 1}</strong>
        <Button variant="link" size="small" disabled={busy} onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="quotation-adjustment-fields">
        <FormField label="Description" className="quotation-field-wide">
          {(props) => (
            <Input
              {...props}
              maxLength={MAX_QUOTATION_DESCRIPTION_LENGTH}
              value={line.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
            />
          )}
        </FormField>
        <FormField label="Effect on the total">
          {(props) => (
            <Select
              {...props}
              value={line.direction}
              onChange={(event) =>
                onChange({
                  direction: event.target.value === "deduct" ? "deduct" : "add",
                })
              }
            >
              <option value="add">Adds to the total</option>
              <option value="deduct">Takes off the total</option>
            </Select>
          )}
        </FormField>
        <FormField label="Change type">
          {(props) => (
            <Select
              {...props}
              value={line.kind}
              onChange={(event) => {
                const kind = event.target.value;
                if (
                  kind === "addition" ||
                  kind === "deduction" ||
                  kind === "substitution" ||
                  kind === "adjustment"
                )
                  onChange({ kind });
              }}
            >
              {(
                Object.entries(kindLabels) as [QuotationItem["kind"], string][]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Related service">
          {(props) => (
            <Select
              {...props}
              value={line.serviceId ?? ""}
              onChange={(event) =>
                onChange({ serviceId: event.target.value || null })
              }
            >
              <option value="">None</option>
              {line.serviceId &&
                !services.some((service) => service.id === line.serviceId) && (
                  <option value={line.serviceId}>
                    Selected service ({line.serviceId})
                  </option>
                )}
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                  {service.archivedAt ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Amount (PHP)">
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              max={MAX_QUOTATION_AMOUNT_MINOR / 100}
              value={line.amountMinor / 100 || ""}
              onChange={(event) =>
                onChange({
                  amountMinor: Math.round(Number(event.target.value) * 100),
                })
              }
            />
          )}
        </FormField>
      </div>
    </article>
  );
}

export function Quotations({
  bookingId,
  admin,
  quotationId,
}: {
  bookingId?: string;
  admin: boolean;
  quotationId?: string;
}) {
  const { notify, notifyError } = useNotifications();
  const generation = useRef(0);
  const [services, setServices] = useState<AdminService[]>([]);
  const [serviceError, setServiceError] = useState("");
  const [serviceCursor, setServiceCursor] = useState<string | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  async function loadServices(cursor?: string) {
    const current = generation.current;
    setServiceLoading(true);
    try {
      const result = await getAdminServices({ cursor });
      if (current !== generation.current) return;
      setServices((previous) =>
        cursor ? [...previous, ...result.services] : result.services,
      );
      setServiceCursor(result.nextCursor);
      setServiceError("");
    } catch (cause) {
      if (current !== generation.current) return;
      setServiceError(notifyError(cause, "Unable to load services."));
    } finally {
      if (current === generation.current) setServiceLoading(false);
    }
  }
  const [rows, setRows] = useState<Quotation[]>([]),
    [draft, setDraft] = useState<Quotation | null>(null),
    [items, setItems] = useState<QuotationItem[]>([]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [loadedPageKey, setLoadedPageKey] = useState("");
  const [loadedScope, setLoadedScope] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState("");
  const [showRevision, setShowRevision] = useState(false);
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
    const currentGeneration = generation.current;
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
        currentGeneration !== generation.current ||
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
    } catch (cause) {
      if (
        currentGeneration !== generation.current ||
        sequence !== pageRequest.current ||
        pageKeyRef.current !== key
      )
        return;
      setError(notifyError(cause, "Unable to load quotations."));
    } finally {
      if (
        currentGeneration === generation.current &&
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
      generation.current++;
    };
  }, [bookingId, admin, quotationId]);

  async function action(successMessage: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      notify(successMessage);
      if (pagination.page !== 1) pagination.reset();
      else await load();
    } catch (cause) {
      setError(notifyError(cause, "Unable to update quotation."));
    } finally {
      setBusy(false);
    }
  }

  const update = (index: number, patch: Partial<QuotationItem>) =>
    setItems((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );

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
          <p className="quotation-lede">
            Create a draft from the current package price. You can add
            adjustments before sending it.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void action("Quotation draft created.", async () => {
                const booking = await getAdminBookingRequest(bookingId);
                await createQuotation(
                  bookingId,
                  booking.bookingRequest.updatedAt,
                );
              })
            }
          >
            Create draft
          </Button>
        </section>
      )}

      {!loading && !error && !admin && rows.length === 0 && (
        <p className="quotation-lede">No quotations yet.</p>
      )}

      {admin && draft && serviceError && (
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

      {admin && draft && (
        <fieldset className="quotation-stack" disabled={busy}>
          <div className="quotation-offer-head">
            <div>
              <h2 className="quotation-offer-title">Version {draft.version}</h2>
              <div className="quotation-meta-stack">
                {previousDraftVersion != null && (
                  <p className="quotation-meta">
                    Draft revision of version {previousDraftVersion}.
                  </p>
                )}
                <p className="quotation-meta">
                  Review the adjustments and save. Nothing is sent until you
                  choose Save and send.
                </p>
              </div>
            </div>
            <QuotationStatusBadge status="draft" />
          </div>
          {!draft.adjustmentsReviewed && (
            <p className="quotation-lede">
              Review the adjustments and save to confirm your review.
            </p>
          )}
          <p className="quotation-lede">
            Package base stays {money(draft.baseAmountMinor)}. Each adjustment
            below is added to it or taken off it.
          </p>

          {serviceCursor && (
            <Button
              variant="secondary"
              disabled={serviceLoading}
              onClick={() => void loadServices(serviceCursor)}
            >
              Load more services
            </Button>
          )}
          {items.map((line, index) => (
            <QuotationAdjustmentCard
              key={line.id}
              line={line}
              index={index}
              services={services}
              busy={busy}
              onChange={(patch) => update(index, patch)}
              onRemove={() =>
                setItems((current) => current.filter((_, i) => i !== index))
              }
            />
          ))}

          <div className="quotation-actions quotation-actions-start">
            <Button
              variant="secondary"
              disabled={items.length >= MAX_QUOTATION_ITEMS}
              onClick={() =>
                setItems((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    direction: "add",
                    kind: "adjustment",
                    description: "",
                    amountMinor: 0,
                    serviceId: null,
                  },
                ])
              }
            >
              Add adjustment
            </Button>
          </div>

          <QuotationMathBox
            baseAmountMinor={draft.baseAmountMinor}
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
              onClick={() =>
                void action("Quotation adjustments saved.", () =>
                  saveQuotation(draft.id, draft.updatedAt, items),
                )
              }
            >
              Save adjustments
            </Button>
            <Button
              disabled={busy || editorTotal < 0}
              onClick={() =>
                void action("Quotation saved and sent.", async () => {
                  const saved = await saveQuotation(
                    draft.id,
                    draft.updatedAt,
                    items,
                  );
                  setDraft(saved.quotation);
                  setItems(saved.quotation.items);
                  setRows((current) =>
                    current.map((quote) =>
                      quote.id === saved.quotation.id ? saved.quotation : quote,
                    ),
                  );
                  await sendQuotation(
                    saved.quotation.id,
                    saved.quotation.updatedAt,
                  );
                })
              }
            >
              Save and send
            </Button>
          </div>

          {admin && (
            <div className="quotation-revision quotation-revision-quiet">
              <FormField label="Reason for the revision">
                {(props) => (
                  <Textarea
                    {...props}
                    maxLength={MAX_QUOTATION_REASON_LENGTH}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </FormField>
              <div className="quotation-actions quotation-actions-start">
                <Button
                  variant="secondary"
                  disabled={busy || !reason.trim()}
                  onClick={() =>
                    void action(
                      "Quotation revision started. Review and save the draft.",
                      async () => {
                        await reviseQuotation(
                          draft.id,
                          draft.updatedAt,
                          reason.trim(),
                        );
                        setReason("");
                      },
                    )
                  }
                >
                  Start another revision
                </Button>
              </div>
            </div>
          )}
        </fieldset>
      )}

      {!draft && currentOffer && (
        <div className="quotation-stack">
          <QuotationSummaryRead quotation={currentOffer} />
          {!admin && (
            <p className="quotation-lede">Discuss this offer in Messages.</p>
          )}
          {admin && (
            <div className="quotation-revision">
              {!showRevision ? (
                <div className="quotation-actions quotation-actions-start">
                  <Button disabled={busy} onClick={() => setShowRevision(true)}>
                    Revise this offer
                  </Button>
                </div>
              ) : (
                <>
                  <h3>Revise this offer</h3>
                  {currentOffer.status === "accepted" && (
                    <p className="quotation-lede">
                      Starting a revision immediately supersedes this accepted
                      offer.
                    </p>
                  )}
                  <FormField label="Reason for the revision">
                    {(props) => (
                      <Textarea
                        {...props}
                        maxLength={MAX_QUOTATION_REASON_LENGTH}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    )}
                  </FormField>
                  <div className="quotation-actions">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setShowRevision(false);
                        setReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void action(
                          "Quotation revision started. Review and save the draft.",
                          async () => {
                            await reviseQuotation(
                              currentOffer.id,
                              currentOffer.updatedAt,
                              reason.trim(),
                            );
                            setReason("");
                            setShowRevision(false);
                          },
                        )
                      }
                    >
                      Start revision
                    </Button>
                  </div>
                </>
              )}
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
                  <b>{money(quotation.totalAmountMinor)}</b>
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
