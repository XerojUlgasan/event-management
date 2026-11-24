import { Button, Icon } from "@event-management/ui";
import type { BookingRequest } from "../../lib/data/booking-requests/requests";
import { groupCustomerEvents } from "../../lib/services/booking-requests/customer-event-timeline";
import {
  bookingDate,
  bookingRequestLabel,
  BookingStatusBadge,
  EventCompletionBadge,
} from "./BookingRequestDisplay";
import { localInput } from "../../lib/utils/event-days/event-day-time";
import { formatEnPh } from "../../lib/utils/formatting/dates";

function requestedTime(item: BookingRequest, date: string | null) {
  const day = item.requestedDays?.find((day) => day.date === date);

  const startsAt = day ? day.startsAt : item.startsAt;
  const endsAt = day ? day.endsAt : item.endsAt;

  if (!startsAt || !endsAt) return "Time to be arranged";

  const overnight =
    localInput(startsAt, item.timeZone).slice(0, 10) !==
    localInput(endsAt, item.timeZone).slice(0, 10);
  const start = formatEnPh(new Date(startsAt), {
    timeStyle: "short",
    timeZone: item.timeZone,
  });
  const end = formatEnPh(new Date(endsAt), {
    ...(overnight ? { dateStyle: "medium" } : {}),
    timeStyle: "short",
    timeZone: item.timeZone,
  });

  return `${start} – ${end}`;
}

export function CustomerEventTimeline({
  items,
  now,
  hasMore,
  onDetails,
  onOpenChat,
}: {
  items: BookingRequest[];
  now: Date;
  hasMore: boolean;
  onDetails: (item: BookingRequest) => void;
  onOpenChat?: (reference: string) => void;
}) {
  return (
    <div className="customer-event-timeline">
      {groupCustomerEvents(items, now).map((group) => {
        if (!group.events.length && group.key !== "upcoming") return null;

        return (
          <section
            className={`event-timeline-group event-timeline-${group.key}`}
            key={group.key}
            aria-labelledby={`event-group-${group.key}`}
          >
            <div className="event-timeline-heading">
              <h2 id={`event-group-${group.key}`}>{group.label}</h2>
              <span>
                {group.events.length}{" "}
                {hasMore
                  ? "loaded"
                  : group.events.length === 1
                    ? "request"
                    : "requests"}
              </span>
              <p>{group.description}</p>
            </div>
            {!group.events.length ? (
              <p className="event-timeline-empty">
                {hasMore
                  ? "No upcoming dates in the requests loaded so far. Load earlier requests below to see more."
                  : "No upcoming requested dates. When you plan another event, you’ll find it here."}
              </p>
            ) : (
              <ul className="event-timeline-list">
                {group.events.map(({ item, date, dayCount }) => (
                  <li key={item.id}>
                    <article
                      className="event-timeline-card"
                      aria-labelledby={`event-title-${item.id}`}
                    >
                      <div className="event-timeline-date" aria-hidden="true">
                        {date ? (
                          <>
                            <span>
                              {new Intl.DateTimeFormat("en-PH", {
                                month: "short",
                                timeZone: "UTC",
                              }).format(new Date(`${date}T00:00:00Z`))}
                            </span>
                            <strong>{Number(date.slice(8, 10))}</strong>
                            <span>{date.slice(0, 4)}</span>
                          </>
                        ) : (
                          <Icon name="calendar" size={25} />
                        )}
                      </div>
                      <div className="event-timeline-content">
                        <div className="event-timeline-card-heading">
                          <div>
                            <p className="event-timeline-type">
                              {item.eventType}
                            </p>
                            <h3 id={`event-title-${item.id}`}>
                              {item.packageName ??
                                "No catalog package selected"}
                            </h3>
                          </div>
                          {item.eventCompletion?.status === "finished" ? (
                            <EventCompletionBadge status="finished" />
                          ) : (
                            <BookingStatusBadge status={item.status} />
                          )}
                        </div>
                        <p className="event-timeline-schedule">
                          <Icon name="calendar" size={15} />
                          <span>
                            {group.key === "finished" ? (
                              <>Marked finished {bookingDate(date)}</>
                            ) : date ? (
                              <>
                                {dayCount > 1 &&
                                (group.key === "upcoming" ||
                                  group.key === "today")
                                  ? "Next requested"
                                  : "Requested"}{" "}
                                {bookingDate(date)}
                                {dayCount > 1
                                  ? ` · ${dayCount} requested days`
                                  : ""}
                              </>
                            ) : (
                              "Date to be arranged"
                            )}
                            {group.key !== "finished" && (
                              <span className="event-timeline-zone">
                                {requestedTime(item, date)} · {item.timeZone}
                              </span>
                            )}
                          </span>
                        </p>
                        {item.status === "needs_details" && (
                          <p className="event-timeline-attention">
                            The team needs more details. Open chat to follow up.
                          </p>
                        )}
                        <div className="event-timeline-footer">
                          <div className="event-timeline-actions">
                            {onOpenChat && (
                              <Button
                                variant="light"
                                icon="message"
                                onClick={() => onOpenChat(item.reference)}
                                aria-label={`Open chat for ${bookingRequestLabel(item.eventType, date)}`}
                              >
                                Open chat
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              onClick={() => onDetails(item)}
                              aria-label={`View details for ${bookingRequestLabel(item.eventType, date)}`}
                            >
                              View details <Icon name="arrow" size={15} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
