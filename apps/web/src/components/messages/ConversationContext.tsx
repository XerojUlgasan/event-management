import { useEffect, useState } from "react";
import {
  Button,
  ActionLink,
  Dialog,
  Drawer,
  Icon,
  useNotifications,
} from "@event-management/ui";
import type { CatalogPackage } from "@event-management/contracts/catalog";
import type { Quotation } from "@event-management/contracts/quotations";
import {
  getAdminBookingRequest,
  getMyBookingRequest,
  type BookingRequest,
} from "../../lib/data/booking-requests/requests";
import { getBookingPackage } from "../../lib/data/booking-requests/packages";
import { getLatestSentQuotation } from "../../lib/services/quotations/latest-sent-quotation";
import {
  bookingDate,
  bookingDateTime,
  BookingStatusBadge,
} from "../booking-requests/BookingRequestDisplay";
import { PackagePreview } from "../catalog/PackagePreview";
import { QuotationSummaryRead } from "../quotations/Quotations";
import { adminBookingRequestPath, customerPaths } from "../app/routes";

export type ConversationContextView = "details" | "package" | "quotation";
type Content =
  | { kind: "details"; booking: BookingRequest }
  | { kind: "package"; package: CatalogPackage | null }
  | { kind: "quotation"; quotation: Quotation | null };

function EventDetails({
  booking,
  admin,
}: {
  booking: BookingRequest;
  admin: boolean;
}) {
  return (
    <div className="conversation-details">
      <div className="conversation-details-heading">
        <span>Request {booking.reference}</span>
        <BookingStatusBadge status={booking.status} />
      </div>
      <h3>{booking.eventType}</h3>
      <dl className="conversation-details-fields">
        <div>
          <dt>Guest count</dt>
          <dd>
            {booking.guestCount == null
              ? "To be discussed"
              : `${booking.guestCount} guests`}
          </dd>
        </div>
        <div>
          <dt>Preferred venue</dt>
          <dd>{booking.preferredVenueLocation || "To be discussed"}</dd>
        </div>
        <div>
          <dt>Contact person</dt>
          <dd>{booking.contactName}</dd>
        </div>
        <div>
          <dt>Phone number</dt>
          <dd>{booking.phoneNumber}</dd>
        </div>
        <div>
          <dt>Special requests</dt>
          <dd>{booking.specialRequests || "None provided"}</dd>
        </div>
      </dl>
      <h4>Requested dates</h4>
      <p className="conversation-details-note">
        Times use {booking.timeZone}. These dates are not reserved.
      </p>
      {booking.requestedDays?.length ? (
        <ul className="conversation-requested-days">
          {booking.requestedDays.map((day) => (
            <li key={day.date}>
              <Icon name="calendar" size={17} />
              <div>
                <strong>{bookingDate(day.date)}</strong>
                <span>
                  {day.startsAt && day.endsAt
                    ? `${bookingDateTime(day.startsAt, booking.timeZone)} – ${bookingDateTime(day.endsAt, booking.timeZone)}`
                    : "Times to be discussed"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <dl className="conversation-details-fields">
          <div>
            <dt>Preferred date</dt>
            <dd>{bookingDate(booking.preferredDate)}</dd>
          </div>
          {booking.startsAt && (
            <div>
              <dt>Start</dt>
              <dd>{bookingDateTime(booking.startsAt, booking.timeZone)}</dd>
            </div>
          )}
          {booking.endsAt && (
            <div>
              <dt>End</dt>
              <dd>{bookingDateTime(booking.endsAt, booking.timeZone)}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="conversation-details-note">
        An inquiry does not confirm a booking. View the current package and
        quotation using their separate conversation controls.
      </p>
      <ActionLink
        href={
          admin
            ? adminBookingRequestPath(booking.id)
            : customerPaths["My events"]
        }
      >
        {admin ? "View booking" : "Manage request in My events"}
      </ActionLink>
    </div>
  );
}

export function ConversationContext({
  bookingId,
  admin,
  view,
  onClose,
}: {
  bookingId: string;
  admin: boolean;
  view: ConversationContextView;
  onClose: () => void;
}) {
  const { notifyError } = useNotifications();
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    setContent(null);
    async function load() {
      try {
        let result: Content;
        if (view === "details") {
          const response = await (admin
            ? getAdminBookingRequest(bookingId)
            : getMyBookingRequest(bookingId));
          result = { kind: "details", booking: response.bookingRequest };
        } else if (view === "package") {
          const response = await getBookingPackage(bookingId, admin);
          result = { kind: "package", package: response.package };
        } else {
          result = {
            kind: "quotation",
            quotation: await getLatestSentQuotation(bookingId, admin),
          };
        }
        if (active) setContent(result);
      } catch (cause) {
        if (active)
          setError(
            notifyError(
              cause,
              `Unable to load ${view === "details" ? "event details" : view === "package" ? "the current package" : "the latest sent quotation"}.`,
            ),
          );
      } finally {
        if (active) setPending(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [bookingId, admin, view, attempt, notifyError]);
  const retry = () => setAttempt((value) => value + 1);
  if (view === "package" && content?.kind === "package" && !content.package)
    return (
      <Dialog title="Current package" onClose={onClose}>
        <p>Package to be prepared. Amount to be discussed.</p>
      </Dialog>
    );
  if (view === "package")
    return (
      <PackagePreview
        item={content?.kind === "package" ? content.package : null}
        loading={pending}
        error={error}
        onRetry={retry}
        onClose={onClose}
        showBookingAction={false}
      />
    );
  const body = (
    <>
      {pending && (
        <p role="status">
          Loading{" "}
          {view === "details" ? "event details" : "the latest sent quotation"}…
        </p>
      )}
      {error && (
        <div role="alert" className="conversation-context-error">
          <p>{error}</p>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
      {content?.kind === "details" && (
        <EventDetails booking={content.booking} admin={admin} />
      )}
      {content?.kind === "quotation" &&
        (content.quotation ? (
          <>
            <p className="conversation-details-note">
              Latest sent quotation · Version {content.quotation.version}
            </p>
            <QuotationSummaryRead quotation={content.quotation} />
          </>
        ) : (
          <div className="conversation-context-empty">
            <Icon name="clipboard" size={28} />
            <h3>No quotation has been sent yet</h3>
            <p>
              {admin
                ? "Send an offer from the booking's quotations when it is ready."
                : "The Styled by AMAC team will share your offer in this conversation when it is ready."}
            </p>
          </div>
        ))}
    </>
  );
  return view === "details" ? (
    <Drawer
      title="Event details"
      onClose={onClose}
      className="conversation-context-drawer"
    >
      {body}
    </Drawer>
  ) : (
    <Dialog
      title="Latest sent quotation"
      onClose={onClose}
      className="conversation-quotation-dialog"
    >
      {body}
    </Dialog>
  );
}
