import {
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useNotifications,
  type FormFieldControlProps,
} from "@event-management/ui";
import {
  MAX_EVENT_TYPE_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_PHONE_NUMBER_LENGTH,
  MAX_SPECIAL_REQUESTS_LENGTH,
} from "@event-management/contracts/limits/booking-requests";
import { useEffect, useId, useState, type SubmitEvent } from "react";
import {
  dateError,
  todayInZone,
} from "../../lib/utils/booking-requests/booking-dates";
import {
  adminCreateBookingForCustomer,
  type BookingRequest,
} from "../../lib/data/booking-requests/requests";
import { getAdminPackages } from "../../lib/data/catalog/packages";
import type { ChatConversation } from "../../lib/data/messages/conversations";
import type { BookingDraftFields } from "../../lib/services/booking-requests/booking-draft";

const OTHER = "__other__";
const COMMON_EVENT_TYPES: readonly string[] = ["Birthday", "Wedding", "Corporate"];

type Fields = BookingDraftFields;
type Errors = Partial<Record<keyof Fields | "packageId", string>>;

function validate(fields: Fields, packageId: string, zone: string): Errors {
  const errors: Errors = {};
  if (!packageId) errors.packageId = "Choose a package.";
  const eventType =
    fields.eventType === OTHER
      ? fields.customEventType.trim()
      : fields.eventType.trim();
  if (!fields.eventType) errors.eventType = "Choose an event type.";
  else if (!eventType) errors.customEventType = "Enter the event type.";
  else if (eventType.length > MAX_EVENT_TYPE_LENGTH)
    errors[fields.eventType === OTHER ? "customEventType" : "eventType"] =
      `Use ${MAX_EVENT_TYPE_LENGTH} characters or fewer.`;
  if (
    fields.dates.length < (fields.durationMode === "multi_day" ? 2 : 1) ||
    (fields.durationMode === "one_day" && fields.dates.length !== 1)
  )
    errors.dates = "Choose the required number of dates.";
  else if (fields.dates.some((date, index) => dateError(date, index, fields.dates, zone)))
    errors.dates = "Check the dates below.";
  if (!fields.contactName.trim()) errors.contactName = "Enter a contact person.";
  if (!fields.phoneNumber.trim()) errors.phoneNumber = "Enter a phone number.";
  for (const [key, limit] of [
    ["contactName", MAX_CONTACT_NAME_LENGTH],
    ["phoneNumber", MAX_PHONE_NUMBER_LENGTH],
    ["specialRequests", MAX_SPECIAL_REQUESTS_LENGTH],
  ] as const)
    if (fields[key].trim().length > limit)
      errors[key] = `Use ${limit} characters or fewer.`;
  return errors;
}

export function AdminBookForCustomerDialog({
  conversation,
  onClose,
  onSuccess,
}: {
  conversation: ChatConversation;
  onClose: () => void;
  onSuccess: (booking: BookingRequest) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const prefix = useId();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Package picker state
  const [packages, setPackages] = useState<{ id: string; name: string; maxGuests: number; priceMinor: number }[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packageId, setPackageId] = useState("");

  // Form fields — pre-fill contact from conversation customer name
  const [fields, setFields] = useState<Fields>({
    eventType: "",
    customEventType: "",
    durationMode: "one_day",
    dates: [""],
    contactName: conversation.customerName || "",
    phoneNumber: "",
    specialRequests: "",
  });

  const [touched, setTouched] = useState<Partial<Record<keyof Fields | "packageId", boolean>>>({});
  const [confirmOneDay, setConfirmOneDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Load active catalog packages on mount
  useEffect(() => {
    let active = true;
    setPackagesLoading(true);
    getAdminPackages({ archived: "active" })
      .then((result) => {
        if (!active) return;
        setPackages(
          result.packages.map((p) => ({
            id: p.id,
            name: p.name,
            maxGuests: p.maxGuests,
            priceMinor: p.price.amountMinor,
          })),
        );
      })
      .catch(() => {
        if (active) notifyError("Unable to load packages.");
      })
      .finally(() => {
        if (active) setPackagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [notifyError]);

  const errors = validate(fields, packageId, timeZone);

  const change = (key: keyof Fields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const field = (
    key: keyof Fields | "packageId",
    label: string,
    control: (fieldProps: FormFieldControlProps) => React.ReactNode,
    wide = false,
  ) => (
    <FormField
      label={label}
      htmlFor={`${prefix}-${key}`}
      className={wide ? "booking-wide" : undefined}
      error={touched[key] ? (errors as Record<string, string | undefined>)[key] : undefined}
    >
      {control}
    </FormField>
  );

  const inputProps = (key: Exclude<keyof Fields, "dates" | "durationMode">) => ({
    id: `${prefix}-${key}`,
    value: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      change(key, e.target.value),
    onBlur: () => setTouched((prev) => ({ ...prev, [key]: true })),
  });

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate(fields, packageId, timeZone);
    if (Object.keys(found).length) {
      setTouched(Object.fromEntries([...Object.keys(found), "packageId"].map((k) => [k, true])));
      notifyError("Please check the highlighted fields.");
      return;
    }
    setBusy(true);
    setSubmitError("");
    try {
      const eventType = (
        fields.eventType === OTHER ? fields.customEventType : fields.eventType
      ).trim();
      const result = await adminCreateBookingForCustomer({
        customerId: conversation.customerId,
        conversationId: conversation.id,
        packageId,
        eventType,
        durationMode: fields.durationMode,
        requestedDays: [...fields.dates].sort().map((date) => ({ date })),
        timeZone,
        contactName: fields.contactName.trim(),
        phoneNumber: fields.phoneNumber.trim(),
        ...(fields.specialRequests.trim()
          ? { specialRequests: fields.specialRequests.trim() }
          : {}),
      });
      notify(`Booking ${result.bookingRequest.reference} created.`);
      onSuccess(result.bookingRequest);
    } catch (cause) {
      setSubmitError(notifyError(cause, "Unable to create booking. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const selectedPackage = packages.find((p) => p.id === packageId);

  return (
    <Dialog
      title="Book for customer"
      eyebrow={`${conversation.customerName} · ${conversation.customerEmail}`}
      onClose={onClose}
      className="admin-book-dialog"
    >
      <form onSubmit={handleSubmit} noValidate className="admin-book-form">
        <div className="booking-fields">

          {/* Package picker */}
          {field("packageId", "Package", (fp) => (
            <Select
              {...fp}
              id={`${prefix}-packageId`}
              value={packageId}
              disabled={packagesLoading}
              onChange={(e) => {
                setPackageId(e.target.value);
                setTouched((prev) => ({ ...prev, packageId: true }));
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, packageId: true }))}
            >
              <option value="">
                {packagesLoading ? "Loading packages…" : "Select a package"}
              </option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(p.priceMinor / 100)} · up to {p.maxGuests} guests
                </option>
              ))}
            </Select>
          ))}

          {/* Event type */}
          {field("eventType", "Event type", (fp) => (
            <Select {...fp} {...inputProps("eventType")}>
              <option value="">Select event type</option>
              {COMMON_EVENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
              <option value={OTHER}>Not on the list</option>
            </Select>
          ))}

          {fields.eventType === OTHER &&
            field("customEventType", "Your event type", (fp) => (
              <Input
                {...fp}
                {...inputProps("customEventType")}
                maxLength={MAX_EVENT_TYPE_LENGTH}
              />
            ), true)}

          {/* Duration mode */}
          <FormField label="Event duration" htmlFor={`${prefix}-duration`}>
            {(fp) => (
              <Select
                {...fp}
                id={`${prefix}-duration`}
                value={fields.durationMode}
                onChange={(e) => {
                  const mode = e.target.value === "multi_day" ? "multi_day" : "one_day";
                  if (mode === "one_day" && fields.dates.length > 1) {
                    setConfirmOneDay(true);
                    return;
                  }
                  setConfirmOneDay(false);
                  setFields((prev) => ({
                    ...prev,
                    durationMode: mode,
                    dates: mode === "one_day" ? prev.dates.slice(0, 1) : prev.dates,
                  }));
                }}
              >
                <option value="one_day">1 day</option>
                <option value="multi_day">Multi-day</option>
              </Select>
            )}
          </FormField>

          {confirmOneDay && (
            <div className="booking-wide" role="group" aria-label="Confirm removing extra dates">
              <p>Keep first date and remove extra dates?</p>
              <div className="booking-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmOneDay(false)}
                >
                  Keep Multi-day
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setFields((prev) => ({
                      ...prev,
                      durationMode: "one_day",
                      dates: prev.dates.slice(0, 1),
                    }));
                    setConfirmOneDay(false);
                  }}
                >
                  Use 1 day and remove extra dates
                </Button>
              </div>
            </div>
          )}

          {/* Requested dates */}
          <div className="booking-wide">
            <strong>Requested dates</strong>
            {fields.dates.map((date, index) => (
              <div key={index}>
                <label htmlFor={`${prefix}-date-${index}`}>Day {index + 1}</label>
                <Input
                  id={`${prefix}-date-${index}`}
                  type="date"
                  min={todayInZone(timeZone)}
                  value={date}
                  aria-invalid={
                    !!(touched.dates && dateError(date, index, fields.dates, timeZone))
                  }
                  onChange={(e) =>
                    setFields((prev) => ({
                      ...prev,
                      dates: prev.dates.map((v, i) => (i === index ? e.target.value : v)),
                    }))
                  }
                  onBlur={() => setTouched((prev) => ({ ...prev, dates: true }))}
                />
                {touched.dates && dateError(date, index, fields.dates, timeZone) && (
                  <p role="alert">{dateError(date, index, fields.dates, timeZone)}</p>
                )}
                {fields.dates.length > 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setFields((prev) => ({
                        ...prev,
                        dates: prev.dates.filter((_, i) => i !== index),
                      }))
                    }
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
                onClick={() =>
                  setFields((prev) => ({ ...prev, dates: [...prev.dates, ""] }))
                }
              >
                Add day
              </Button>
            )}
            {touched.dates && errors.dates && <p role="alert">{errors.dates}</p>}
          </div>

          {/* Contact */}
          <div className="booking-contact-row">
            {field("phoneNumber", "Phone number", (fp) => (
              <Input {...fp} {...inputProps("phoneNumber")} type="tel" maxLength={MAX_PHONE_NUMBER_LENGTH} />
            ))}
            {field("contactName", "Contact person", (fp) => (
              <Input {...fp} {...inputProps("contactName")} maxLength={MAX_CONTACT_NAME_LENGTH} />
            ))}
          </div>

          {/* Special requests */}
          {field(
            "specialRequests",
            "Special requests (optional)",
            (fp) => (
              <Textarea
                {...fp}
                {...inputProps("specialRequests")}
                maxLength={MAX_SPECIAL_REQUESTS_LENGTH}
              />
            ),
            true,
          )}
        </div>

        {selectedPackage && (
          <p className="admin-book-package-note">
            Package: <strong>{selectedPackage.name}</strong> ·{" "}
            {new Intl.NumberFormat("en-PH", {
              style: "currency",
              currency: "PHP",
            }).format(selectedPackage.priceMinor / 100)}{" "}
            · up to {selectedPackage.maxGuests} guests
          </p>
        )}

        <p className="admin-book-note">
          This creates a booking on behalf of {conversation.customerName}. The
          preferred dates are not reserved. Time zone: {timeZone}.
        </p>

        {submitError && (
          <p role="alert" className="admin-book-error">
            {submitError}
          </p>
        )}

        <div className="booking-actions">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" pending={busy} disabled={packagesLoading}>
            {busy ? "Creating…" : "Create booking"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
