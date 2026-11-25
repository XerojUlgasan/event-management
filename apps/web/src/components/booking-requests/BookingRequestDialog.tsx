import {
  Button,
  FormField,
  Icon,
  Input,
  InputGroup,
  NativeDialog,
  Select,
  Textarea,
  useNotifications,
  type FormFieldControlProps,
} from "@event-management/ui";
import {
  MAX_EVENT_TYPE_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_SPECIAL_REQUESTS_LENGTH,
} from "@event-management/contracts/limits/booking-requests";
import {
  personNameValidationMessage,
  sanitizePersonNameInput,
} from "@event-management/contracts/person-name";
import {
  PH_MOBILE_COUNTRY_CODE,
  formatPhilippineMobileDisplay,
  formatPhilippineMobileStorage,
  parsePhilippineMobileDigits,
  philippineMobileValidationMessage,
  sanitizePhilippineMobileDigitInput,
} from "@event-management/contracts/philippine-mobile";
import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import { createPortal } from "react-dom";
import {
  dateError,
  earliestSelectableEventDate,
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

const BOOKING_STEPS = [
  { id: 1, label: "Event details" },
  { id: 2, label: "Contact" },
  { id: 3, label: "Add-ons" },
  { id: 4, label: "Review" },
] as const;

type BookingFormStep = (typeof BOOKING_STEPS)[number]["id"];

type ValidateScope = "event" | "contact" | "all";

const COMMON_EVENT_TYPES: readonly string[] = [
  "Birthday",
  "Wedding",
  "Corporate",
];

type Fields = BookingDraftFields;

type Errors = Partial<Record<keyof Fields, string>>;

function validate(
  fields: Fields,
  requireName = true,
  scope: ValidateScope = "all",
): Errors {
  const errors: Errors = {};
  const checkEvent = scope === "event" || scope === "all";
  const checkContact = scope === "contact" || scope === "all";

  if (checkEvent) {
    const earliest = earliestSelectableEventDate();
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
      errors.dates =
        fields.durationMode === "multi_day"
          ? "Choose at least two dates for a multi-day event."
          : "Choose one date for a one-day event.";
    else if (
      fields.dates.some((date, index) =>
        dateError(date, index, fields.dates, earliest),
      )
    )
      errors.dates = "Check the dates below.";

    if (fields.specialRequests.trim().length > MAX_SPECIAL_REQUESTS_LENGTH)
      errors.specialRequests = `Use ${MAX_SPECIAL_REQUESTS_LENGTH} characters or fewer.`;
  }

  if (checkContact) {
    if (requireName) {
      const nameMessage = personNameValidationMessage(fields.contactName);

      if (nameMessage) errors.contactName = nameMessage;
      else if (fields.contactName.trim().length > MAX_CONTACT_NAME_LENGTH)
        errors.contactName = `Use ${MAX_CONTACT_NAME_LENGTH} characters or fewer.`;
    }

    const phoneMessage = philippineMobileValidationMessage(fields.phoneNumber);

    if (phoneMessage) errors.phoneNumber = phoneMessage;
  }

  return errors;
}

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
      phoneNumber: parsePhilippineMobileDigits(
        typeof old?.phoneNumber === "string" ? old.phoneNumber : "",
      ),
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

  const [step, setStep] = useState<BookingFormStep>(() => (saved ? 4 : 1));

  const [confirmOneDay, setConfirmOneDay] = useState(false);
  const [touched, setTouched] = useState<
    Partial<Record<keyof Fields, boolean>>
  >({});
  const [auth, setAuth] = useState<
    "loading" | "customer" | "signed-out" | "admin" | "error"
  >("loading");
  const [busy, setBusy] = useState(false);

  const [noteOpen, setNoteOpen] = useState(() => !!fields.specialRequests);

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
  const errors = validate(
    fields,
    auth === "customer",
    step === 1 ? "event" : "contact",
  );

  const change = (key: keyof Fields, value: string) => {
    if (key === "contactName") nameEdited.current = true;

    setFields((current) => ({
      ...current,
      [key]:
        key === "phoneNumber"
          ? sanitizePhilippineMobileDigitInput(value)
          : key === "contactName"
            ? sanitizePersonNameInput(value)
            : value,
    }));
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
    const found = validate(fields);

    if (Object.keys(found).length) {
      setTouched(
        Object.fromEntries(Object.keys(found).map((key) => [key, true])),
      );

      if (found.contactName || found.phoneNumber) setStep(2);
      else if (
        found.eventType ||
        found.customEventType ||
        found.dates ||
        found.specialRequests
      )
        setStep(1);
      else setStep(3);

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
        phoneNumber: formatPhilippineMobileStorage(fields.phoneNumber),
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
        setStep(2);
        setError(notifyError("Your session ended. Sign in to continue."));
      } else if (
        cause instanceof ApiError &&
        cause.code === "booking_package_changed"
      ) {
        setPackageChanged(true);
        setStep(3);
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

  const stepScope = (current: BookingFormStep): ValidateScope =>
    current === 1 ? "event" : current === 2 ? "contact" : "all";

  const markTouchedForScope = (scope: ValidateScope) => {
    if (scope === "event") {
      setTouched((current) => ({
        ...current,
        eventType: true,
        customEventType: true,
        dates: true,
        specialRequests: true,
      }));
    } else if (scope === "contact") {
      setTouched((current) => ({
        ...current,
        contactName: true,
        phoneNumber: true,
      }));
    } else {
      setTouched(
        Object.fromEntries(
          (
            [
              "eventType",
              "customEventType",
              "dates",
              "contactName",
              "phoneNumber",
              "specialRequests",
            ] as const
          ).map((key) => [key, true]),
        ),
      );
    }
  };

  const continueFromStep = (event?: SubmitEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const scope = step === 3 ? "all" : stepScope(step);
    const found = validate(fields, auth === "customer", scope);

    if (Object.keys(found).length) {
      markTouchedForScope(scope);

      if (step === 3) setStep(found.contactName || found.phoneNumber ? 2 : 1);

      requestAnimationFrame(() => summary.current?.focus());

      return;
    }

    if (step === 3) {
      if (needsAddonReview) {
        setError(
          "Check the hours, confirm changed services, and remove any services already included in the package.",
        );
        requestAnimationFrame(() => formError.current?.focus());

        return;
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

      if (auth === "customer") setStep(4);

      return;
    }

    setStep((current) => (current + 1) as BookingFormStep);
    setError("");
  };

  const backStep = () => {
    setStep((current) =>
      current > 1 ? ((current - 1) as BookingFormStep) : current,
    );
    setError("");
  };

  const earliestEventDate = earliestSelectableEventDate();

  const dateErrors = touched.dates
    ? fields.dates.map((date, index) =>
        dateError(date, index, fields.dates, earliestEventDate),
      )
    : [];

  const field = (
    key: keyof Fields,
    label: string,
    control: (fieldProps: FormFieldControlProps) => React.ReactNode,
  ) => (
    <FormField
      label={label}
      className={
        key === "specialRequests" || key === "customEventType"
          ? "booking-wide"
          : undefined
      }
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
        {!submitted && (
          <Button
            size="icon"
            variant="secondary"
            type="button"
            className="booking-close"
            onClick={cancel}
            aria-label="Close booking request"
          >
            <Icon name="close" size={24} strokeWidth={2.5} />
          </Button>
        )}
        <span className="booking-eyebrow">
          Styled by AMAC / Booking request
        </span>
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          {submitted
            ? "Your booking request has been submitted"
            : step === 4
              ? "Review your request"
              : BOOKING_STEPS.find((entry) => entry.id === step)?.label ??
                "Let’s plan your event"}
        </h2>
        <p className="booking-intro">
          {item
            ? `${item.name} · ${priceLabel(item.price)}`
            : "Package to be discussed"}
        </p>
        {submitted ? (
          <>
            <p>Our team will review your request and follow up in Messages.</p>
            <div className="booking-actions">
              <Button variant="secondary" type="button" onClick={cancel}>
                Close
              </Button>
            </div>
          </>
        ) : step === 4 ? (
          <>
            <dl className="booking-review">
              <div>
                <dt>Event</dt>
                <dd>
                  {fields.eventType === OTHER
                    ? fields.customEventType
                    : fields.eventType}
                </dd>
              </div>
              <div>
                <dt>Event duration</dt>
                <dd>
                  {fields.durationMode === "one_day"
                    ? "1 day"
                    : `Multi-day (${fields.dates.length} date rows)`}
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
              <div>
                <dt>Contact</dt>
                <dd>
                  {fields.contactName} ·{" "}
                  {formatPhilippineMobileStorage(fields.phoneNumber) ||
                    PH_MOBILE_COUNTRY_CODE}
                </dd>
              </div>
              <div>
                <dt>Special requests</dt>
                <dd>{fields.specialRequests || "None"}</dd>
              </div>
            </dl>
            <BookingAddons
              item={item}
              rows={addons}
              onChange={setAddons}
              readOnly
            />
            <p>
              Your preferred date is not reserved. An administrator will review
              availability and the final price.
            </p>
            {error && <p role="alert">{error}</p>}
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
            <div className="booking-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setStep(1)}
              >
                Edit details
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
          </>
        ) : (
          <form onSubmit={continueFromStep} noValidate>
            <nav className="booking-steps" aria-label="Booking progress">
              <ol>
                {BOOKING_STEPS.map((entry) => (
                  <li
                    key={entry.id}
                    data-active={entry.id === step}
                    data-complete={entry.id < step}
                  >
                    <span>{entry.id}</span>
                    {entry.label}
                  </li>
                ))}
              </ol>
            </nav>
            {step < 3 &&
              Object.keys(errors).some((key) => touched[key as keyof Fields]) && (
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
              <FormField label="Event duration" htmlFor={`${prefix}-duration`}>
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
              {fields.eventType === OTHER &&
                field("customEventType", "Your event type", (fieldProps) => (
                  <Input
                    {...fieldProps}
                    {...props("customEventType")}
                    maxLength={MAX_EVENT_TYPE_LENGTH}
                  />
                ))}
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
                          document.getElementById(`${prefix}-date-0`)?.focus(),
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
                <p className="booking-date-helper" id={`${prefix}-date-hint`}>
                  Request your event at least 1 calendar day in advance
                  (Philippine time).
                </p>
                {fields.dates.map((date, index) => (
                  <div className="booking-date-row" key={index}>
                    <FormField
                      label={`Day ${index + 1}`}
                      htmlFor={`${prefix}-date-${index}`}
                      error={dateErrors[index]}
                    >
                      {(fieldProps) => (
                        <Input
                          {...fieldProps}
                          type="date"
                          min={earliestEventDate}
                          value={date}
                          aria-describedby={[
                            `${prefix}-date-hint`,
                            fieldProps["aria-describedby"],
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={(event) => {
                            if (!event.isTrusted) return;

                            try {
                              event.currentTarget.showPicker?.();
                            } catch {
                              // Keep the native input usable if the browser blocks showPicker.
                            }
                          }}
                          onChange={(event) =>
                            setFields((current) => ({
                              ...current,
                              dates: current.dates.map((value, i) =>
                                i === index ? event.target.value : value,
                              ),
                            }))
                          }
                        />
                      )}
                    </FormField>
                    {fields.dates.length > 1 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setFields((current) => ({
                            ...current,
                            dates: current.dates.filter((_, i) => i !== index),
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
                        Remove day {index + 1}
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
                {touched.dates && errors.dates && !dateErrors.some(Boolean) && (
                  <p className="booking-field-error" role="alert">
                    {errors.dates}
                  </p>
                )}
              </div>
                <details
                  className="booking-note booking-wide"
                  open={noteOpen}
                  onToggle={(event) => setNoteOpen(event.currentTarget.open)}
                >
                  <summary>Add a note (optional)</summary>
                  {field(
                    "specialRequests",
                    "Special requests or services",
                    (fieldProps) => (
                      <Textarea
                        {...fieldProps}
                        {...props("specialRequests")}
                        maxLength={MAX_SPECIAL_REQUESTS_LENGTH}
                      />
                    ),
                  )}
                </details>
                <p className="booking-wide booking-step-note">
                  Enter times for each requested day after submitting. Your
                  device time zone ({timeZone}) is saved with this request.
                </p>
              </div>
            )}
            {step === 2 && (
              <div className="booking-fields">
                <p className="booking-wide booking-step-lead">
                  We will use this contact for updates about your request.
                </p>
                {field(
                  "contactName",
                  "Contact person",
                  (fieldProps) => (
                    <Input
                      {...fieldProps}
                      {...props("contactName")}
                      autoComplete="name"
                      maxLength={MAX_CONTACT_NAME_LENGTH}
                    />
                  ),
                )}
                {field("phoneNumber", "Mobile number", (fieldProps) => (
                  <InputGroup
                    leading={
                      <span className="booking-phone-prefix" aria-hidden>
                        {PH_MOBILE_COUNTRY_CODE}
                      </span>
                    }
                  >
                    <Input
                      {...fieldProps}
                      id={`${prefix}-phoneNumber`}
                      variant="plain"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      aria-describedby={[
                        `${prefix}-phone-hint`,
                        fieldProps["aria-describedby"],
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      value={formatPhilippineMobileDisplay(fields.phoneNumber)}
                      onChange={(event) =>
                        change("phoneNumber", event.target.value)
                      }
                      onBlur={() =>
                        setTouched((current) => ({
                          ...current,
                          phoneNumber: true,
                        }))
                      }
                      placeholder="9XX XXX XXXX"
                    />
                  </InputGroup>
                ))}
                <p
                  id={`${prefix}-phone-hint`}
                  className="booking-wide booking-date-helper"
                >
                  Philippine mobile only: 10 digits starting with 9 after +63.
                </p>
              </div>
            )}
            {step === 3 && (
              <>
                <p className="booking-step-lead">
                  {item
                    ? `${item.name} · ${priceLabel(item.price)}`
                    : "Optional add-on services for team review."}
                </p>
                <BookingAddons item={item} rows={addons} onChange={setAddons} />
                <p className="booking-step-note">
                  Your preferred date is not reserved. An administrator will
                  review availability and the final price.
                </p>
              </>
            )}
            {auth === "signed-out" && (
              <p>
                Sign in to continue. Your details will be saved for this
                session, and you’ll review them before submitting.
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
            <div className="booking-actions">
              <Button variant="secondary" type="button" onClick={cancel}>
                Cancel
              </Button>
              {step > 1 && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={backStep}
                  disabled={busy}
                >
                  Back
                </Button>
              )}
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
                {busy
                  ? "Submitting…"
                  : auth === "loading"
                    ? "Checking session…"
                    : auth === "signed-out" && step === 3
                      ? "Sign in to continue"
                      : step === 3
                        ? "Review request"
                        : "Continue"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </NativeDialog>,
    document.body,
  );
}
