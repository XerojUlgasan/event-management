import { Fragment, useEffect, useId, useRef, useState } from "react";
import {
  Button,
  FormField,
  Icon,
  Input,
  Textarea,
  useNotifications,
} from "@event-management/ui";
import {
  MAX_QUOTATION_AMOUNT_MINOR,
  MAX_QUOTATION_DESCRIPTION_LENGTH,
  MAX_QUOTATION_ITEMS,
  MAX_QUOTATION_REASON_LENGTH,
  type ManualQuotationItem,
  type Quotation,
  type QuotationAddonItem,
  type QuotationItem,
  type QuotationPreparation,
  type SendQuotationInput,
} from "@event-management/contracts/quotations";
import { getAdminBookingRequest } from "../../lib/data/booking-requests/requests";
import {
  prepareQuotation,
  sendQuotation,
} from "../../lib/data/quotations/quotations";
import { ApiError } from "../../lib/http/request";
import { useRequestGeneration } from "../../lib/pagination/use-request-generation";
import {
  centavosToPesos,
  formatPesosFromMinor,
  formatSignedPesosFromMinor,
  pesosToCentavos,
} from "../../lib/utils/formatting/money";

function chargeAmount(line: QuotationItem) {
  if (line.amountMinor === null || line.addon?.requiresRemoval)
    return "Incomplete";

  return formatSignedPesosFromMinor(
    line.direction === "deduct" ? -line.amountMinor : line.amountMinor,
  );
}

function quotationAmounts(base: number, items: QuotationItem[]) {
  const additions = items.reduce(
    (sum, line) =>
      sum + (line.direction === "add" ? (line.amountMinor ?? 0) : 0),
    0,
  );

  const deductions = items.reduce(
    (sum, line) =>
      sum + (line.direction === "deduct" ? (line.amountMinor ?? 0) : 0),
    0,
  );

  const total = base + additions - deductions;

  return { base, additions, deductions, total };
}

function QuotationAmounts({
  base,
  additions,
  deductions,
  total,
  incomplete,
}: ReturnType<typeof quotationAmounts> & { incomplete: boolean }) {
  return (
    <>
      <div className="quotation-math" aria-live="polite">
        <div>
          <span>Package base</span>
          <span>{formatPesosFromMinor(base)}</span>
        </div>
        <div>
          <span>Additions</span>
          <span>{formatSignedPesosFromMinor(additions)}</span>
        </div>
        <div>
          <span>Deductions</span>
          <span className="quotation-amount-deduct">
            {formatSignedPesosFromMinor(-deductions)}
          </span>
        </div>
        <div className="quotation-math-grand">
          <span>Offer total</span>
          <span>{incomplete ? "Incomplete" : formatPesosFromMinor(total)}</span>
        </div>
      </div>
      {!incomplete && (total < 0 || total > MAX_QUOTATION_AMOUNT_MINOR) && (
        <p className="quotation-negative-warn" role="alert">
          {total < 0
            ? "The total is below zero. Raise an amount or remove a deduction before sending."
            : "The total exceeds the maximum quotation amount. Adjust the charges before sending."}
        </p>
      )}
    </>
  );
}

const adjustmentOptions = [
  { direction: "add", kind: "addition", icon: "plus", label: "Add a fee" },
  {
    direction: "deduct",
    kind: "deduction",
    icon: "minus",
    label: "Apply a discount",
  },
] as const;

function QuotationAdjustmentFields({
  line,
  onChange,
  descriptionError,
}: {
  line: ManualQuotationItem;
  onChange: (patch: Partial<ManualQuotationItem>) => void;
  descriptionError?: string;
}) {
  const directionGroup = useId();

  return (
    <div className="quotation-adjustment-fields">
      <FormField
        label="Description"
        className="quotation-adjustment-description"
        error={descriptionError}
      >
        {(props) => (
          <Input
            {...props}
            maxLength={MAX_QUOTATION_DESCRIPTION_LENGTH}
            value={line.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        )}
      </FormField>
      <FormField label="Amount (PHP)">
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max={centavosToPesos(MAX_QUOTATION_AMOUNT_MINOR)}
            value={centavosToPesos(line.amountMinor) || ""}
            onChange={(event) =>
              onChange({
                amountMinor: pesosToCentavos(Number(event.target.value)),
              })
            }
          />
        )}
      </FormField>
      <fieldset className="quotation-adjustment-direction">
        <legend className="sr-only">Effect on the total</legend>
        <div className="quotation-adjustment-options">
          {adjustmentOptions.map(({ direction, kind, icon, label }) => (
            <label key={direction} title={label}>
              <Input
                variant="plain"
                type="radio"
                name={directionGroup}
                value={direction}
                aria-label={label}
                checked={line.direction === direction}
                onChange={() => onChange({ direction, kind })}
              />
              <span>
                <Icon name={icon} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

type Operation = "prepare" | "send" | "package";

export function QuotationComposer({
  bookingId,
  currentOffer,
  onCancel,
  onSent,
  onRefresh,
  onOfferChanged,
  onBusyChange,
}: {
  bookingId: string;
  currentOffer: Quotation | null;
  onCancel: () => void;
  onSent: (quotation: Quotation) => void;
  onRefresh: () => Promise<void>;
  onOfferChanged: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const [preparation, setPreparation] = useState<QuotationPreparation>();
  const [localManualItems, setLocalManualItems] =
    useState<ManualQuotationItem[]>();
  const [editing, setEditing] = useState<ManualQuotationItem | null>(null);
  const [applyAttempted, setApplyAttempted] = useState(false);
  const [reason, setReason] = useState("");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [error, setError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const generation = useRequestGeneration();
  const inFlight = useRef<Operation | null>(null);
  const attempt = useRef<{ contents: string; requestId: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const editorOpener = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const composerId = useId();
  const editorId = useId();

  function begin(kind: Operation) {
    if (inFlight.current) return null;

    inFlight.current = kind;
    setOperation(kind);
    onBusyChange(true);
    const ticket = generation.current();

    return () => generation.isCurrent(ticket);
  }

  function finish() {
    inFlight.current = null;
    setOperation(null);
    onBusyChange(false);
  }

  function applyPreparation(next: QuotationPreparation) {
    setPreparation(next);
  }

  async function loadPreparation(refresh = false) {
    const isCurrent = begin("prepare");

    if (!isCurrent) return;

    setError("");

    try {
      if (refresh) await onRefresh();

      if (!isCurrent()) return;

      const [{ preparation: next }, { bookingRequest }] = await Promise.all([
        prepareQuotation(bookingId),
        getAdminBookingRequest(bookingId),
      ]);

      if (!isCurrent()) return;

      applyPreparation(next);
      setNeedsReview(
        bookingRequest.updatedAt !== next.expectedBookingUpdatedAt,
      );
      const previousOffer = preparation
        ? preparation.currentOffer
        : currentOffer;
      const offerChanged =
        previousOffer?.id !== next.currentOffer?.id ||
        previousOffer?.updatedAt !== next.currentOffer?.updatedAt;

      if (offerChanged) {
        setReason("");
        onOfferChanged();
      }

      if (refresh || offerChanged) {
        setReviewMessage(
          offerChanged
            ? "The latest offer changed. Review the current offer and these charges before sending."
            : "Review the refreshed package charges before sending.",
        );
      }

      return next;
    } catch (cause) {
      if (isCurrent()) {
        const message = notifyError(cause, "Unable to prepare the quotation.");
        setError(message);

        if (preparation) setNeedsReview(true);

        if (refresh) throw new Error(message);
      }
    } finally {
      if (isCurrent()) finish();
    }
  }

  useEffect(() => {
    headingRef.current?.focus();
    void loadPreparation();

    return () => {
      generation.bump();
      inFlight.current = null;
    };
  }, []);

  const editingId = editing?.id;

  useEffect(() => {
    if (editingId) editorRef.current?.focus();
  }, [editingId]);

  function closeEditor() {
    setEditing(null);
    setApplyAttempted(false);
    editorOpener.current?.focus();
  }

  const addonItems =
    preparation?.items.filter(
      (line): line is QuotationAddonItem => !!line.addon,
    ) ?? [];

  const manualItems =
    localManualItems ?? preparation?.items.filter((line) => !line.addon) ?? [];

  const items: QuotationItem[] = [...addonItems, ...manualItems];
  const amounts = quotationAmounts(preparation?.baseAmountMinor ?? 0, items);
  const { total } = amounts;

  const incomplete = addonItems.some(
    (line) => line.amountMinor === null || line.addon.requiresRemoval,
  );

  const canSend =
    !!preparation &&
    !incomplete &&
    !needsReview &&
    !operation &&
    !editing &&
    items.length <= MAX_QUOTATION_ITEMS &&
    total >= 0 &&
    total <= MAX_QUOTATION_AMOUNT_MINOR &&
    (!preparation.currentOffer || !!reason.trim());

  async function send() {
    if (!canSend || !preparation) return;

    const isCurrent = begin("send");

    if (!isCurrent) return;

    const body: Omit<SendQuotationInput, "requestId"> = {
      expectedBookingUpdatedAt: preparation.expectedBookingUpdatedAt,
      packageId: preparation.packageId,
      expectedPackageUpdatedAt: preparation.expectedPackageUpdatedAt,
      currentOffer: preparation.currentOffer,
      revisionReason: preparation.currentOffer ? reason.trim() : null,
      items: manualItems.map((line) => ({ ...line, serviceId: null })),
    };

    const contents = JSON.stringify(body);

    if (attempt.current?.contents !== contents) {
      attempt.current = { contents, requestId: crypto.randomUUID() };
    }

    setError("");
    setReviewMessage("");

    try {
      const { quotation } = await sendQuotation(bookingId, {
        ...body,
        requestId: attempt.current.requestId,
      });

      if (isCurrent()) {
        notify("Quotation sent.");
        onSent(quotation);
      }
    } catch (cause) {
      if (!isCurrent()) return;

      setError(notifyError(cause, "Unable to send the quotation."));

      if (cause instanceof ApiError && cause.status === 409)
        setNeedsReview(true);
    } finally {
      if (isCurrent()) finish();
    }
  }

  const addingManual =
    !!editing && !manualItems.some((line) => line.id === editing.id);

  const inlineEditor = editing && (
    <section
      ref={editorRef}
      id={editorId}
      className="quotation-inline-editor quotation-inline-charge"
      tabIndex={-1}
      aria-labelledby={`${editorId}-title`}
    >
      <h3 id={`${editorId}-title`}>
        {addingManual ? "Add a fee or discount" : "Edit fee or discount"}
      </h3>
      <QuotationAdjustmentFields
        line={editing}
        onChange={(patch) => {
          setEditing({ ...editing, ...patch });
          if (patch.description !== undefined) setApplyAttempted(false);
        }}
        descriptionError={
          applyAttempted && !editing.description.trim()
            ? "A description is required."
            : undefined
        }
      />
      <div className="quotation-actions quotation-actions-start">
        <Button variant="secondary" size="small" onClick={closeEditor}>
          Cancel adjustment
        </Button>
        <Button
          size="small"
          onClick={() => {
            if (
              !editing.description.trim() ||
              !Number.isSafeInteger(editing.amountMinor) ||
              editing.amountMinor <= 0 ||
              editing.amountMinor > MAX_QUOTATION_AMOUNT_MINOR
            ) {
              setApplyAttempted(true);
              return;
            }
            setLocalManualItems(
              addingManual
                ? [...manualItems, editing]
                : manualItems.map((line) =>
                    line.id === editing.id ? editing : line,
                  ),
            );
            closeEditor();
          }}
        >
          Apply
        </Button>
      </div>
    </section>
  );

  return (
    <section aria-labelledby={composerId} className="quotation-stack">
      <h2
        ref={headingRef}
        id={composerId}
        tabIndex={-1}
        className="quotation-offer-title"
      >
        {preparation?.currentOffer ? "Revise quotation" : "Prepare quotation"}
      </h2>
      {operation === "prepare" && (
        <p role="status">
          {needsReview ? "Refreshing quotation…" : "Preparing quotation…"}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {reviewMessage && <p role="status">{reviewMessage}</p>}
      {needsReview && (
        <div className="quotation-actions quotation-actions-start">
          <p role="alert">
            The booking or package changed. Refresh before sending.
          </p>
          <Button
            variant="secondary"
            disabled={!!operation}
            onClick={() => void loadPreparation(true).catch(() => {})}
          >
            Refresh and review
          </Button>
        </div>
      )}
      {preparation ? (
        <fieldset className="quotation-stack" disabled={!!operation}>
          {preparation.currentOffer && (
            <FormField
              label="Reason for the revision"
              error={
                !reason.trim()
                  ? "A reason is required before sending a revised quotation."
                  : undefined
              }
            >
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  required
                  maxLength={MAX_QUOTATION_REASON_LENGTH}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </FormField>
          )}
          <div className="quotation-charge-list">
            <div className="quotation-charge-row">
              <div>
                <strong>Package base</strong>
                <span>Included services</span>
              </div>
              <strong>
                {formatPesosFromMinor(preparation.baseAmountMinor)}
              </strong>
            </div>
            {addonItems.map((line) => (
              <div
                key={`${line.addon.source.packageId}:${line.id}`}
                className="quotation-charge-row"
              >
                <div className="quotation-charge-label">
                  <strong>{line.description}</strong>
                  <span>
                    {line.addon.totalHours == null
                      ? "Hours open"
                      : `${line.addon.totalHours} ${line.addon.totalHours === 1 ? "hour" : "hours"}`}
                  </span>
                  {line.addon.requiresRemoval && (
                    <span>
                      {line.addon.requiresRemoval === "archived"
                        ? "Service archived. Remove it from the booking to continue."
                        : "Now included in the package. Remove the add-on from the booking to continue."}
                    </span>
                  )}
                </div>
                <strong>{chargeAmount(line)}</strong>
              </div>
            ))}
            {manualItems.map((line) => {
              const isEditing = editing?.id === line.id;

              return (
                <Fragment key={line.id}>
                  <div className="quotation-charge-row">
                    <div className="quotation-charge-label">
                      <strong>{line.description}</strong>
                      <span>
                        {line.direction === "deduct"
                          ? "Discount"
                          : "Manual fee"}
                      </span>
                    </div>
                    <strong>{chargeAmount(line)}</strong>
                    <div className="quotation-charge-actions">
                      <Button
                        variant="secondary"
                        size="icon"
                        icon="edit"
                        aria-label={`Edit ${line.description}`}
                        title="Edit"
                        aria-expanded={isEditing}
                        aria-controls={isEditing ? editorId : undefined}
                        disabled={!!editing && !isEditing}
                        onClick={(event) => {
                          if (isEditing) closeEditor();
                          else {
                            editorOpener.current = event.currentTarget;
                            setApplyAttempted(false);
                            setEditing(line);
                          }
                        }}
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        icon="trash"
                        aria-label={`Remove ${line.description}`}
                        title="Remove"
                        disabled={!!editing}
                        onClick={() => {
                          setLocalManualItems(
                            manualItems.filter((item) => item.id !== line.id),
                          );
                          headingRef.current?.focus();
                        }}
                      />
                    </div>
                  </div>
                  {isEditing && inlineEditor}
                </Fragment>
              );
            })}
          </div>
          <div className="quotation-actions quotation-actions-start">
            <Button
              variant="secondary"
              size="small"
              icon="plus"
              aria-expanded={addingManual}
              aria-controls={addingManual ? editorId : undefined}
              disabled={
                items.length >= MAX_QUOTATION_ITEMS ||
                (!!editing && !addingManual)
              }
              onClick={(event) => {
                if (addingManual) closeEditor();
                else {
                  editorOpener.current = event.currentTarget;
                  setApplyAttempted(false);
                  setEditing({
                    id: crypto.randomUUID(),
                    direction: "add",
                    kind: "addition",
                    description: "",
                    amountMinor: 0,
                    serviceId: null,
                  });
                }
              }}
            >
              Add fee or discount
            </Button>
          </div>
          {addingManual && inlineEditor}
          {incomplete && (
            <p role="status">
              Finish service hours on the booking before sending this offer.
            </p>
          )}
          {items.length > MAX_QUOTATION_ITEMS && (
            <p role="alert">
              Remove fees or discounts to stay within the quotation item limit.
            </p>
          )}
          <QuotationAmounts {...amounts} incomplete={incomplete} />
          <p className="quotation-fine">
            This offer does not confirm the booking or reserve the date.
          </p>
        </fieldset>
      ) : (
        error && (
          <Button
            variant="secondary"
            disabled={!!operation}
            onClick={() => void loadPreparation()}
          >
            Retry preparation
          </Button>
        )
      )}
      <div className="quotation-actions">
        <Button
          variant="secondary"
          disabled={operation === "package" || operation === "send"}
          onClick={() => {
            if (inFlight.current !== "send" && inFlight.current !== "package")
              onCancel();
          }}
        >
          Cancel
        </Button>
        {preparation && (
          <Button
            disabled={!canSend}
            pending={operation === "send"}
            onClick={() => void send()}
          >
            {operation === "send" ? "Sending…" : "Send"}
          </Button>
        )}
      </div>
    </section>
  );
}
