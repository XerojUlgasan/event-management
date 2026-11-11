import "../../styles/booking-request.css";
import {
  MAX_QUOTATION_ITEMS,
  MAX_QUOTATION_DESCRIPTION_LENGTH,
  MAX_QUOTATION_REASON_LENGTH,
  MAX_QUOTATION_AMOUNT_MINOR,
} from "@event-management/contracts/quotations";
import type { Quotation, QuotationItem, QuotationStatus } from "@event-management/contracts/quotations";
import { getAdminServices, type AdminService } from "../../lib/data/services";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@event-management/ui";
import {
  acceptQuotation,
  createQuotation,
  getQuotation,
  getQuotations,
  reviseQuotation,
  saveQuotation,
  sendQuotation,
} from "../../lib/data/quotations";
import { getAdminBookingRequest } from "../../lib/data/booking-requests";

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
    return `Version ${quotation.version} was sent on ${formatWhen(quotation.sentAt)}. The customer has not accepted it.`;
  }
  if (quotation.status === "superseded" && quotation.supersededAt) {
    return `Version ${quotation.version} was sent on ${quotation.sentAt ? formatWhen(quotation.sentAt) : "an earlier date"}. Replaced by a newer version.`;
  }
  return `Version ${quotation.version}.`;
}

function QuotationSummaryRead({ quotation }: { quotation: Quotation }) {
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
        <p className="quotation-meta">Revision note: {quotation.revisionReason}</p>
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
                line.direction === "deduct" ? "quotation-amount-deduct" : undefined
              }
            >
              {signedMoney(
                line.direction === "deduct" ? -line.amountMinor : line.amountMinor,
              )}
            </b>
          </div>
        ))}
      </div>
      <p className="quotation-fine">
        Accepting this offer does not confirm the booking or reserve the date.
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
                  direction:
                    event.target.value === "deduct" ? "deduct" : "add",
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
  const [services, setServices] = useState<AdminService[]>([]);
  const [serviceError, setServiceError] = useState("");
  async function loadServices() {
    try {
      setServices((await getAdminServices()).services);
      setServiceError("");
    } catch (cause) {
      setServiceError(
        cause instanceof Error ? cause.message : "Unable to load services.",
      );
    }
  }
  const [rows, setRows] = useState<Quotation[]>([]),
    [draft, setDraft] = useState<Quotation | null>(null),
    [items, setItems] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result =
        quotationId && !admin
          ? [(await getQuotation(quotationId)).quotation]
          : bookingId
            ? (await getQuotations(bookingId, admin)).quotations.filter(
                (q) => !quotationId || q.id === quotationId,
              )
            : [];
      setRows(result);
      const current = result.find((q) => q.status === "draft") ?? null;
      setDraft(current);
      setItems(current?.items ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load quotations.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    if (admin) void loadServices();
  }, [bookingId, admin, quotationId]);

  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update quotation.",
      );
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
  const currentOffer = sorted.find(
    (q) => q.status === "sent" || q.status === "accepted",
  );
  const earlierVersions = sorted.filter((q) => q.status === "superseded");

  const previousDraftVersion =
    draft?.previousQuotationId != null
      ? rows.find((q) => q.id === draft.previousQuotationId)?.version
      : undefined;

  const adminEmpty =
    admin &&
    bookingId &&
    !quotationId &&
    !loading &&
    !error &&
    !draft &&
    rows.length === 0;

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
              void action(async () => {
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

      {draft && serviceError && (
        <p role="alert">
          {serviceError}{" "}
          <Button variant="secondary" onClick={() => void loadServices()}>
            Retry services
          </Button>
        </p>
      )}

      {draft && (
        <fieldset className="quotation-stack" disabled={busy}>
          <div className="quotation-offer-head">
            <div>
              <h2 className="quotation-offer-title">
                Version {draft.version}
              </h2>
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
            Accepting this offer does not confirm the booking or reserve the
            date.
          </p>

          <div className="quotation-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void action(() =>
                  saveQuotation(draft.id, draft.updatedAt, items),
                )
              }
            >
              Save adjustments
            </Button>
            <Button
              disabled={busy || editorTotal < 0}
              onClick={() =>
                void action(async () => {
                  const saved = await saveQuotation(
                    draft.id,
                    draft.updatedAt,
                    items,
                  );
                  setDraft(saved.quotation);
                  setItems(saved.quotation.items);
                  setRows((current) =>
                    current.map((quote) =>
                      quote.id === saved.quotation.id
                        ? saved.quotation
                        : quote,
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
                    void action(async () => {
                      await reviseQuotation(
                        draft.id,
                        draft.updatedAt,
                        reason.trim(),
                        true,
                      );
                      setReason("");
                    })
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
          {currentOffer.status === "sent" && !admin && (
            <div className="quotation-actions quotation-actions-start">
              <Button
                disabled={busy}
                onClick={() =>
                  void action(() =>
                    acceptQuotation(currentOffer.id, currentOffer.updatedAt),
                  )
                }
              >
                Accept quotation
              </Button>
            </div>
          )}
          {(currentOffer.status === "sent" ||
            currentOffer.status === "accepted") && (
            <div className="quotation-revision">
              {!showRevision ? (
                <div className="quotation-actions quotation-actions-start">
                  <Button
                    variant={admin ? undefined : "secondary"}
                    disabled={busy || (admin && !!draft)}
                    onClick={() => setShowRevision(true)}
                  >
                    {admin ? "Revise this offer" : "Request revision"}
                  </Button>
                </div>
              ) : (
                <>
                  <h3>
                    {admin ? "Revise this offer" : "Request revision"}
                  </h3>
                  {currentOffer.status === "accepted" && (
                    <p className="quotation-lede">
                      Starting a revision immediately supersedes this accepted
                      agreement. The customer must accept the new version.
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
                      disabled={busy || !reason.trim() || (admin && !!draft)}
                      onClick={() =>
                        void action(async () => {
                          await reviseQuotation(
                            currentOffer.id,
                            currentOffer.updatedAt,
                            reason.trim(),
                            admin,
                          );
                          setReason("");
                          setShowRevision(false);
                        })
                      }
                    >
                      {admin ? "Start revision" : "Request revision"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {earlierVersions.length > 0 && (
        <section className="quotation-history" aria-labelledby="quotation-history-title">
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
                      Version {quotation.version} · {statusLabel[quotation.status]}
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
        </section>
      )}
    </section>
  );
}
