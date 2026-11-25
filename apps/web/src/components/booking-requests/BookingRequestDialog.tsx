import {
  Button,
  FormField,
  Input,
  InputGroup,
  NativeDialog,
  Select,
  Textarea,
  useNotifications,
  type FormFieldControlProps,
} from "@event-management/ui";
import {
  CONTACT_NAME_REGEX,
  MAX_CONTACT_NAME_LENGTH,
  MAX_EVENT_TYPE_LENGTH,
  MAX_SPECIAL_REQUESTS_LENGTH,
  MIN_ADVANCE_BOOKING_DAYS,
  PH_PHONE_REGEX,
} from "@event-management/contracts/limits/booking-requests";
import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import { createPortal } from "react-dom";
import {
  dateError,
  minBookingDateInZone,
} from "../../lib/utils/booking-requests/booking-dates";
import { ApiError } from "../../lib/http/request";
import { priceLabel } from "../../lib/utils/formatting/money";
import { getMe } from "../../lib/data/auth/session";
import { createBookingRequest } from "../../lib/data/booking-requests/requests";
import {
  getPackage,
  type PublicPackage,
} from "../../lib/data/catalog/packages";
import {
  clearBookingDraft,
  readBookingDraft,
  saveBookingDraft,
  type BookingDraftFields,
} from "../../lib/services/booking-requests/booking-draft";

import {
  BookingAddons,
  includedServiceIds,
  validAddonHours,
} from "./BookingAddons";

const OTHER = "__other__";

const COMMON_EVENT_TYPES: readonly string[] = [
  "Birthday",
  "Wedding",
  "Corporate",
];

type Fields = BookingDraftFields;

type Errors = Partial<Record<keyof Fields, string>>;

// Fields validated per step — step 3 uses needsAddonReview, step 4 uses all.
const STEP_FIELDS: Record<number, (keyof Fields)[]> = {
  1: ["eventType", "customEventType", "dates"],
  2: ["contactName", "phoneNumber"],
};

function validate(fields: Fields, zone: string, requireName = true): Errors {
  const errors: Errors = {};
  const eventType =
    fields.eventType === OTHER
      ? fields.customEventType.trim()
      : fields.eventType.trim();

  if (!fields.eventType) errors.eventType = "Choose an event type.";
  else if (!eventType) errors.customEventType = "Enter your event type.";
  else if (eventType.length > MAX_EVENT_TYPE_LENGTH)
    errors[fields.eventType === OTHER ? "customEventType" : "eventType"] =
      `Use ${MAX_EVENT_TYPE_LENGTH} characters or fewer.`;

  if (
    fields.dates.length < (fields.durationMode === "multi_day" ? 2 : 1) ||
    (fields.durationMode === "one_day" && fields.dates.length !== 1)
  )
    errors.dates = "Choose the required number of dates.";
  else if (
    fields.dates.some((date, index) =>
      dateError(date, index, fields.dates, zone),
    )
  )
    errors.dates = "Check the dates below.";

  if (requireName && !fields.contactName.trim())
    errors.contactName = "Enter a contact person.";
  else if (
    requireName &&
    fields.contactName.trim() &&
    !CONTACT_NAME_REGEX.test(fields.contactName.trim())
  )
    errors.contactName =
      "Name may only contain letters, spaces, hyphens, and apostrophes.";

  if (!fields.phoneNumber.trim()) errors.phoneNumber = "Enter a phone number.";
  else if (!PH_PHONE_REGEX.test(`+63${fields.phoneNumber.trim()}`))
    errors.phoneNumber =
      "Enter a valid Philippine mobile number (9XX XXX XXXX).";

  for (const [key, limit] of [
    ["contactName", MAX_CONTACT_NAME_LENGTH],
    ["specialRequests", MAX_SPECIAL_REQUESTS_LENGTH],
  ] as const)
    if (fields[key].trim().length > limit)
      errors[key] = `Use ${limit} characters or fewer.`;

  return errors;
}

const STEP_LABELS = ["Event details", "Your details", "Add-on services", "Review"];

export function BookingRequestDialog({
  item: initialItem,
  resume = false,
  onClose,
  conversationId,
  onSubmitted,
}: {
  item: PublicPackage | null;
  conversationId?: string;
  onSubmitted?: () => void;
  resume?: boolean;
  onClose: () => void;
}) {
  const { notify, notifyError } = useNotifications();
  const saved = resume ? readBookingDraft() : null;
  const [item, setItem] = useState(initialItem);
  const [packageChanged, setPackageChanged] = useState(false);

  const [fields, setFields] = useState<Fields>(() => {
    const old = saved?.fields;
    const oldType = typeof old?.eventType === "string" ? old.eventType : "";
    const options = COMMON_EVENT_TYPES;
    const custom =
      oldType === OTHER ||
      oldType === "Other" ||
      (!!oldType && !options.includes(oldType));

    return {
      eventType: oldType ? (custom ? OTHER : oldType) : "",
      customEventType: custom
        ? oldType === OTHER
          ? typeof old?.customEventType === "string"
            ? old.customEventType
            : ""
          : oldType === "Other"
            ? ""
            : oldType
        : "",
      durationMode: old?.durationMode === "multi_day" ? "multi_day" : "one_day",
      dates:
        Array.isArray(old?.dates) &&
        old.dates.every((date) => typeof date === "string") &&
        old.dates.length
          ? old.dates
          : [""],
      contactName: typeof old?.contactName === "string" ? old.contactName : "",
      phoneNumber: typeof old?.phoneNumber === "string" ? old.phoneNumber : "",
      specialRequests:
        typeof old?.specialRequests === "string" ? old.specialRequests : "",
    };
  });

  const timeZone =
    saved?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [addons, setAddons] = useState(() => saved?.addons ?? []);
  const included = includedServiceIds(item);
  const needsAddonReview = addons.some(
    (row) =>
      !validAddonHours(row) ||
      row.needsReview ||
      included.has(row.service.id.toLowerCase()),
  );

  // step 1–3 = form steps, step 4 = review
  const [step, setStep] = useState<1 | 2 | 3 | 4>(saved ? 4 : 1);
  const [confirmOneDay, setConfirmOneDay] = useState(false);
  const [touched, setTouched] = useState<
    Partial<Record<keyof Fields, boolean>>
  >({});
  const [auth, setAuth] = useState<
    "loading" | "customer" | "signed-out" | "admin" | "error"
  >("loading");
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState(
    saved && saved.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone
      ? "Your browser time zone changed. Your request still uses the saved time zone; please review your dates."
      : "",
  );
  const [submitted, setSubmitted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    summary = useRef<HTMLDivElement>(null),
    formError = useRef<HTMLParagraphElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    nameEdited = useRef(false);
  const currentFields = useRef(fields);
  currentFields.current = fields;
  const titleId = useId(),
    prefix = useId();

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();

    return () => {
      dialog.current?.close();
      trigger?.focus();
    };
  }, []);

  const checkAuth = () => {
    setAuth("loading");
    getMe()
      .then((profile) => {
        setAuth(profile.role === "customer" ? "customer" : "admin");
        const name =
          currentFields.current.contactName.trim() ||
          (!nameEdited.current ? profile.displayName?.trim() : "") ||
          "";

        if (name && !currentFields.current.contactName.trim())
          setFields((current) => ({ ...current, contactName: name }));

        if (profile.role === "customer" && !name && resume) {
          setStep(2);
          setError(
            "Please add a contact person before submitting your request.",
          );
          requestAnimationFrame(() =>
            document.getElementById(`${prefix}-contactName`)?.focus(),
          );
        }
      })
      .catch((cause) => {
        setAuth(
          cause instanceof ApiError && cause.status === 401
            ? "signed-out"
            : "error",
        );

        if (!(cause instanceof ApiError && cause.status === 401))
          notifyError("Unable to check your session. Try again.");
      });
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (step === 4) heading.current?.focus();
  }, [step]);

  const errors = validate(fields, timeZone, auth === "customer");

  const change = (key: keyof Fields, value: string) => {
    if (key === "contactName") nameEdited.current = true;

    setFields((current) => ({ ...current, [key]: value }));
  };

  const cancel = () => {
    clearBookingDraft();
    onClose();
  };

  const refreshPackage = async () => {
    if (!item) return;

    setBusy(true);
    try {
      setItem(await getPackage(item.id));
      setPackageChanged(false);
      setError(
        "Package details refreshed. Review your request before submitting.",
      );
    } catch (cause) {
      setError(notifyError(cause, "Unable to refresh this package."));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => formError.current?.focus());
    }
  };

  const submit = async () => {
    const found = validate(fields, timeZone);

    if (Object.keys(found).length) {
      notifyError("Please check the highlighted fields before submitting.");
      setTouched(
        Object.fromEntries(Object.keys(found).map((key) => [key, true])),
      );
      setStep(1);
      requestAnimationFrame(() => summary.current?.focus());

      return;
    }

    if (needsAddonReview) {
      setStep(3);
      setError(
        "Check the hours, confirm changed services, and remove any services already included in the package.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      await createBookingRequest({
        ...(addons.length
          ? {
              requestedAddons: addons.map((row) => ({
                serviceId: row.service.id,
                serviceUpdatedAt: row.service.updatedAt,
                hours: Number(row.hours),
              })),
            }
          : {}),
        packageId: item?.id ?? null,
        ...(item ? { packageUpdatedAt: item.updatedAt } : {}),
        ...(conversationId ? { conversationId } : {}),
        eventType: (fields.eventType === OTHER
          ? fields.customEventType
          : fields.eventType
        ).trim(),
        durationMode: fields.durationMode,
        requestedDays: [...fields.dates].sort().map((date) => ({ date })),
        timeZone,
        contactName: fields.contactName.trim(),
        phoneNumber: `+63${fields.phoneNumber.trim()}`,
        ...(fields.specialRequests.trim()
          ? { specialRequests: fields.specialRequests.trim() }
          : {}),
      });

      clearBookingDraft();
      setSubmitted(true);
      onSubmitted?.();
      notify(
        "Booking request submitted. Your preferred dates are not reserved.",
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setAuth("signed-out");
        setStep(4);
        setError(notifyError("Your session ended. Sign in to continue."));
      } else if (
        cause instanceof ApiError &&
        cause.code === "booking_package_changed"
      ) {
        setPackageChanged(true);
        setStep(4);
        setError(
          "This package changed. Refresh it to review the current details.",
        );
        requestAnimationFrame(() => formError.current?.focus());
      } else if (
        cause instanceof ApiError &&
        cause.status === 409 &&
        cause.code === "requested_addon_conflict" &&
        cause.resourceId
      ) {
        setAddons((current) =>
          current.map((row) =>
            row.service.id.toLowerCase() === cause.resourceId?.toLowerCase()
              ? { ...row, needsReview: true, refreshed: false }
              : row,
          ),
        );
        setStep(3);
        setError(
          `${cause.message} Refresh and confirm the affected service, or remove it.`,
        );
        requestAnimationFrame(() => formError.current?.focus());
      } else {
        setError(notifyError(cause, "Unable to submit request."));
      }
    } finally {
      setBusy(false);
    }
  };

  // Advance from steps 1–3 to the next step, validating only the current step's fields.
  const next = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 1 || step === 2) {
      const stepKeys = STEP_FIELDS[step];
      const allErrors = validate(fields, timeZone, auth === "customer");
      const stepErrors = Object.fromEntries(
        stepKeys
          .filter((k) => allErrors[k])
          .map((k) => [k, allErrors[k]]),
      ) as Errors;

      if (Object.keys(stepErrors).length) {
        notifyError("Please check the highlighted fields before continuing.");
        setTouched((current) => ({
          ...current,
          ...Object.fromEntries(stepKeys.map((k) => [k, true])),
        }));
        requestAnimationFrame(() => summary.current?.focus());

        return;
      }
    }

    if (step === 3) {
      if (needsAddonReview) {
        setError(
          "Check the hours, confirm changed services, and remove any services already included in the package.",
        );
        requestAnimationFrame(() => formError.current?.focus());
        return;
      }
    }

    if (auth === "signed-out") {
      if (conversationId) {
        setError(
          notifyError(
            "Your session ended. Sign in again and reopen this conversation to submit your request.",
          ),
        );
        return;
      }

      if (!item) return;

      saveBookingDraft({ item, fields, timeZone, addons });
      window.location.assign("/login?booking=resume");

      return;
    }

    setStep((current) => (current < 4 ? ((current + 1) as 1 | 2 | 3 | 4) : 4));
  };

  const back = () => {
    setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3 | 4) : 1));
  };

  const field = (
    key: keyof Fields,
    label: string,
    control: (fieldProps: FormFieldControlProps) => React.ReactNode,
    opts?: { wide?: boolean; optional?: boolean },
  ) => (
    <FormField
      label={
        opts?.optional ? (
          <>
            {label}{" "}
            <span className="booking-field-optional">(optional)</span>
          </>
        ) : (
          label
        )
      }
      className={opts?.wide ? "booking-wide" : undefined}
      htmlFor={`${prefix}-${key}`}
      error={touched[key] ? errors[key] : undefined}
    >
      {control}
    </FormField>
  );

  const props = (key: Exclude<keyof Fields, "dates" | "durationMode">) => ({
    value: fields[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => change(key, e.target.value),
    onBlur: () => setTouched((current) => ({ ...current, [key]: true })),
  });

  // Progress indicator — inline, no component extraction needed.
  const steps = (
    <ol className="booking-steps" aria-label="Booking progress">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = !submitted && step > n;
        const active = step === n;

        return (
          <li
            key={n}
            className={
              done
                ? "booking-step booking-step-done"
                : active
                  ? "booking-step booking-step-active"
                  : "booking-step"
            }
            aria-current={active ? "step" : undefined}
          >
            <span className="booking-step-dot" aria-hidden="true">
              {done ? "✓" : n}
            </span>
            <span className="booking-step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );

  // Shared nav row for steps 1–3.
  const navRow = (
    <div className="booking-actions booking-actions-nav">
      <div className="booking-actions-left">
        {step > 1 && (
          <Button variant="secondary" type="button" onClick={back}>
            ← Back
          </Button>
        )}
      </div>
      <div className="booking-actions-right">
        <Button variant="secondary" type="button" onClick={cancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={
            busy ||
            packageChanged ||
            auth === "loading" ||
            auth === "admin" ||
            auth === "error"
          }
        >
          {auth === "loading"
            ? "Checking session…"
            : auth === "signed-out"
              ? "Sign in to continue"
              : step === 3
                ? "Review request"
                : "Continue →"}
        </Button>
      </div>
    </div>
  );

  const stepTitle = submitted
    ? "Request submitted"
    : step === 4
      ? "Review your request"
      : "Let's plan your event";

  return createPortal(
    <NativeDialog
      ref={dialog}
      className="booking-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }}
    >
      <div className="booking-dialog-body">
        <Button
          size="icon"
          variant="light"
          type="button"
          className="booking-close"
          onClick={cancel}
          aria-label="Close booking request"
        >
          ×
        </Button>
        <span className="booking-eyebrow">
          Styled by AMAC / Booking request
        </span>
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          {stepTitle}
        </h2>
        <p className="booking-intro">
          {item
            ? `${item.name} · ${priceLabel(item.price)}`
            : "Package to be discussed"}
        </p>

        {!submitted && steps}

        {submitted ? (
          <>
            <p>An administrator will review your request.</p>
            <Button variant="secondary" type="button" onClick={cancel}>
              Close
            </Button>
          </>
        ) : step === 4 ? (
          // ── Step 4: Review ──────────────────────────────────────────
          <>
            <div className="booking-review-section">
              <div className="booking-review-section-head">
                <h3>Event details</h3>
                <Button
                  variant="secondary"
                  size="small"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  Edit
                </Button>
              </div>
              <dl className="booking-review-dl">
                <div>
                  <dt>Event type</dt>
                  <dd>
                    {fields.eventType === OTHER
                      ? fields.customEventType
                      : fields.eventType}
                  </dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>
                    {fields.durationMode === "one_day"
                      ? "1 day"
                      : `Multi-day (${fields.dates.length} dates)`}
                  </dd>
                </div>
                <div>
                  <dt>Requested dates</dt>
                  <dd>
                    {fields.dates
                      .map((date) => date || "Date not selected")
                      .join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Time zone</dt>
                  <dd>{timeZone}</dd>
                </div>
              </dl>
            </div>

            <div className="booking-review-section">
              <div className="booking-review-section-head">
                <h3>Your details</h3>
                <Button
                  variant="secondary"
                  size="small"
                  type="button"
                  onClick={() => setStep(2)}
                >
                  Edit
                </Button>
              </div>
              <dl className="booking-review-dl">
                <div>
                  <dt>Contact person</dt>
                  <dd>{fields.contactName || "—"}</dd>
                </div>
                <div>
                  <dt>Phone number</dt>
                  <dd>
                    {fields.phoneNumber ? `+63 ${fields.phoneNumber}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Special requests</dt>
                  <dd>{fields.specialRequests || "None"}</dd>
                </div>
              </dl>
            </div>

            <div className="booking-review-section">
              <div className="booking-review-section-head">
                <h3>Add-on services</h3>
                <Button
                  variant="secondary"
                  size="small"
                  type="button"
                  onClick={() => setStep(3)}
                >
                  Edit
                </Button>
              </div>
              <BookingAddons
                item={item}
                rows={addons}
                onChange={setAddons}
                readOnly
              />
            </div>

            <p className="booking-review-note">
              Your preferred date is not reserved. An administrator will review
              availability and confirm the final price.
            </p>

            {error && (
              <p ref={formError} role="alert" tabIndex={-1}>
                {error}
              </p>
            )}
            {auth === "admin" && (
              <p role="alert">
                Sign in with a customer account to submit a request.
              </p>
            )}
            {auth === "error" && (
              <p role="alert">
                Unable to check your session.{" "}
                <Button variant="secondary" type="button" onClick={checkAuth}>
                  Try again
                </Button>
              </p>
            )}
            {packageChanged && (
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={() => void refreshPackage()}
              >
                Refresh package
              </Button>
            )}
            <div className="booking-actions booking-actions-nav">
              <div className="booking-actions-left">
                <Button variant="secondary" type="button" onClick={back}>
                  ← Back
                </Button>
              </div>
              <div className="booking-actions-right">
                <Button variant="secondary" type="button" onClick={cancel}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  disabled={busy || auth !== "customer"}
                  onClick={() => void submit()}
                >
                  {busy
                    ? "Submitting…"
                    : auth === "loading"
                      ? "Checking session…"
                      : "Submit request"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          // ── Steps 1–3: Entry form ───────────────────────────────────
          <form onSubmit={next} noValidate>
            {Object.keys(touched).some(
              (key) => errors[key as keyof Fields],
            ) && (
              <div
                className="booking-field-error"
                ref={summary}
                tabIndex={-1}
                role="alert"
              >
                Please check the highlighted fields below.
              </div>
            )}

            {step === 1 && (
              // ── Step 1: Event details ─────────────────────────────
              <div className="booking-fields">
                {field("eventType", "Event type", (fieldProps) => (
                  <Select {...fieldProps} {...props("eventType")}>
                    <option value="">Select event type</option>
                    {COMMON_EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                    <option value={OTHER}>Not on the list</option>
                  </Select>
                ))}
                {fields.eventType === OTHER &&
                  field(
                    "customEventType",
                    "Your event type",
                    (fieldProps) => (
                      <Input
                        {...fieldProps}
                        {...props("customEventType")}
                        maxLength={MAX_EVENT_TYPE_LENGTH}
                      />
                    ),
                    { wide: true },
                  )}
                <FormField
                  label="Event duration"
                  htmlFor={`${prefix}-duration`}
                >
                  {(fieldProps) => (
                    <Select
                      {...fieldProps}
                      value={fields.durationMode}
                      onChange={(event) => {
                        const mode =
                          event.target.value === "multi_day"
                            ? "multi_day"
                            : "one_day";

                        if (mode === "one_day" && fields.dates.length > 1) {
                          setConfirmOneDay(true);

                          return;
                        }

                        setConfirmOneDay(false);
                        setFields((current) => ({
                          ...current,
                          durationMode: mode,
                          dates:
                            mode === "one_day"
                              ? current.dates.slice(0, 1)
                              : current.dates,
                        }));
                      }}
                    >
                      <option value="one_day">1 day</option>
                      <option value="multi_day">Multi-day</option>
                    </Select>
                  )}
                </FormField>
                {confirmOneDay && (
                  <div
                    className="booking-wide"
                    role="group"
                    aria-label="Confirm removing extra dates"
                  >
                    <p>Keep first date and remove extra dates?</p>
                    <div className="booking-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setConfirmOneDay(false);
                          requestAnimationFrame(() =>
                            document
                              .getElementById(`${prefix}-duration`)
                              ?.focus(),
                          );
                        }}
                      >
                        Keep Multi-day
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setFields((current) => ({
                            ...current,
                            durationMode: "one_day",
                            dates: current.dates.slice(0, 1),
                          }));
                          setConfirmOneDay(false);
                          requestAnimationFrame(() =>
                            document
                              .getElementById(`${prefix}-date-0`)
                              ?.focus(),
                          );
                        }}
                      >
                        Use 1 day and remove extra dates
                      </Button>
                    </div>
                  </div>
                )}
                <div className="booking-wide">
                  <strong>Requested dates</strong>
                  <p className="booking-dates-hint">
                    Requests must be submitted at least{" "}
                    {MIN_ADVANCE_BOOKING_DAYS} days before the event date.
                  </p>
                  {fields.dates.map((date, index) => (
                    <div key={index} className="booking-date-row">
                      <label htmlFor={`${prefix}-date-${index}`}>
                        Day {index + 1}
                      </label>
                      <Input
                        id={`${prefix}-date-${index}`}
                        type="date"
                        min={minBookingDateInZone(timeZone)}
                        value={date}
                        aria-invalid={
                          !!(
                            touched.dates &&
                            dateError(date, index, fields.dates, timeZone)
                          )
                        }
                        aria-describedby={
                          touched.dates &&
                          dateError(date, index, fields.dates, timeZone)
                            ? `${prefix}-date-error-${index}`
                            : undefined
                        }
                        onChange={(event) =>
                          setFields((current) => ({
                            ...current,
                            dates: current.dates.map((value, i) =>
                              i === index ? event.target.value : value,
                            ),
                          }))
                        }
                        onBlur={() =>
                          setTouched((current) => ({
                            ...current,
                            dates: true,
                          }))
                        }
                      />
                      {touched.dates &&
                        dateError(date, index, fields.dates, timeZone) && (
                          <p
                            id={`${prefix}-date-error-${index}`}
                            className="booking-date-error"
                          >
                            {dateError(date, index, fields.dates, timeZone)}
                          </p>
                        )}
                      {fields.dates.length > 1 && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setFields((current) => ({
                              ...current,
                              dates: current.dates.filter(
                                (_, i) => i !== index,
                              ),
                            }));
                            requestAnimationFrame(() =>
                              document
                                .getElementById(
                                  `${prefix}-date-${Math.max(0, index - 1)}`,
                                )
                                ?.focus(),
                            );
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  {fields.durationMode === "multi_day" && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setFields((current) => ({
                          ...current,
                          dates: [...current.dates, ""],
                        }));
                        requestAnimationFrame(() =>
                          document
                            .getElementById(
                              `${prefix}-date-${fields.dates.length}`,
                            )
                            ?.focus(),
                        );
                      }}
                    >
                      Add day
                    </Button>
                  )}
                  {touched.dates && errors.dates && (
                    <p role="alert" className="booking-date-error">
                      {errors.dates}
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              // ── Step 2: Your details ──────────────────────────────
              <div className="booking-fields">
                <div className="booking-contact-row">
                  {field("contactName", "Contact person", (fieldProps) => (
                    <Input
                      {...fieldProps}
                      {...props("contactName")}
                      maxLength={MAX_CONTACT_NAME_LENGTH}
                      onKeyDown={(event) => {
                        if (/\d/.test(event.key)) event.preventDefault();
                      }}
                      onPaste={(event) => {
                        event.preventDefault();
                        const input = event.currentTarget;
                        const pasted = event.clipboardData
                          .getData("text")
                          .replace(/\d/g, "");
                        const start =
                          input.selectionStart ?? input.value.length;
                        const end = input.selectionEnd ?? input.value.length;
                        const next = (
                          input.value.slice(0, start) +
                          pasted +
                          input.value.slice(end)
                        ).slice(0, MAX_CONTACT_NAME_LENGTH);
                        change("contactName", next);
                        setTouched((current) => ({
                          ...current,
                          contactName: true,
                        }));
                      }}
                    />
                  ))}
                  {field("phoneNumber", "Phone number", (fieldProps) => (
                    <InputGroup>
                      <span aria-hidden="true">+63</span>
                      <Input
                        {...fieldProps}
                        id={fieldProps.id}
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="9XX XXX XXXX"
                        value={fields.phoneNumber}
                        onBlur={() =>
                          setTouched((current) => ({
                            ...current,
                            phoneNumber: true,
                          }))
                        }
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/g, "");
                          change("phoneNumber", digits.slice(0, 10));
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key.length === 1 &&
                            !/\d/.test(event.key)
                          )
                            event.preventDefault();
                        }}
                        onPaste={(event) => {
                          event.preventDefault();
                          const input = event.currentTarget;
                          const digits = event.clipboardData
                            .getData("text")
                            .replace(/\D/g, "");
                          const start =
                            input.selectionStart ?? input.value.length;
                          const end = input.selectionEnd ?? input.value.length;
                          const next = (
                            input.value.slice(0, start) +
                            digits +
                            input.value.slice(end)
                          )
                            .replace(/\D/g, "")
                            .slice(0, 10);
                          change("phoneNumber", next);
                        }}
                      />
                    </InputGroup>
                  ))}
                </div>
                {field(
                  "specialRequests",
                  "Special requests",
                  (fieldProps) => (
                    <Textarea
                      {...fieldProps}
                      {...props("specialRequests")}
                      maxLength={MAX_SPECIAL_REQUESTS_LENGTH}
                      placeholder="Anything you'd like us to know about your event…"
                    />
                  ),
                  { wide: true, optional: true },
                )}
              </div>
            )}

            {step === 3 && (
              // ── Step 3: Add-on services ───────────────────────────
              <div className="booking-addons-step">
                <BookingAddons item={item} rows={addons} onChange={setAddons} />
              </div>
            )}

            {auth === "signed-out" && step < 4 && (
              <p className="booking-auth-note">
                Sign in to continue. Your details will be saved for this
                session, and you'll review them before submitting.
              </p>
            )}
            {auth === "admin" && (
              <p role="alert">
                Sign in with a customer account to submit a request.
              </p>
            )}
            {auth === "error" && (
              <p role="alert">
                Unable to check your session.{" "}
                <Button variant="secondary" type="button" onClick={checkAuth}>
                  Try again
                </Button>
              </p>
            )}
            {error && (
              <p ref={formError} role="alert" tabIndex={-1}>
                {error}
              </p>
            )}
            {packageChanged && (
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={() => void refreshPackage()}
              >
                Refresh package
              </Button>
            )}

            {navRow}
          </form>
        )}
      </div>
    </NativeDialog>,
    document.body,
  );
}
