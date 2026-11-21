import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Badge, Button, Drawer, Icon } from "@event-management/ui";
import {
  NOTIFICATIONS_CHANGED,
  notificationsChangedSchema,
  type Notification,
} from "@event-management/contracts/notifications";
import {
  getNotifications,
  getNotificationRealtimeToken,
  markNotificationRead,
} from "../../lib/data/notifications/notifications";
import { ApiError } from "../../lib/http/request";
import { env } from "../../lib/env/env";
import { navigateWorkspace } from "../../lib/navigation/workspace-navigation";
import { createArrivalTracker } from "../../lib/services/notifications/arrivals";
import {
  isPermanentTokenFailure,
  realtimeRefreshDelay,
} from "../../lib/services/messages/realtime-event";
import { adminBookingRequestPath } from "../app/routes";
import {
  bookingDate,
  bookingStatusLabels,
} from "../booking-requests/BookingRequestDisplay";

function presentation(content: Notification): {
  label: string;
  path: string;
} {
  const booking = "booking" in content ? content.booking : undefined;
  const eventType = booking?.eventType.trim();
  const requestedDate = booking?.preferredDate
    ? ` · Requested ${bookingDate(booking.preferredDate)}`
    : "";

  switch (content.type) {
    case "booking_request_created":
      return {
        label: `${eventType ? `New ${eventType} request` : "New booking request"}${requestedDate}`,
        path: adminBookingRequestPath(content.payload.bookingRequestId),
      };
    case "booking_status_updated":
      return {
        label: `${eventType ? `${eventType} request` : "Booking request"} · ${bookingStatusLabels[content.payload.status]}${requestedDate}`,
        path: `/app/events?bookingRequest=${encodeURIComponent(content.payload.bookingRequestId)}`,
      };
    case "quotation_sent":
      return {
        label: `Quotation version ${content.payload.version} sent`,
        path: `/app/messages?conversation=${encodeURIComponent(content.payload.conversationId)}&quotation=${encodeURIComponent(content.payload.quotationId)}`,
      };
    case "human_review_requested":
      return {
        label: "A conversation needs human review",
        path: `/app/messages?conversation=${encodeURIComponent(content.payload.conversationId)}`,
      };
    default: {
      const exhaustive: never = content;

      return exhaustive;
    }
  }
}

export function NotificationBell({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [arrival, setArrival] = useState<Notification | null>(null);
  const [announcement, setAnnouncement] = useState<Notification | null>(null);
  const arrivalRef = useRef<Notification | null>(null);
  const tracker = useRef(createArrivalTracker());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const drawerOpen = useRef(false);
  const pagesLoaded = useRef(1);
  const fetching = useRef(false);
  const refreshQueued = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async (next?: string) => {
    if (fetching.current) {
      if (!next) refreshQueued.current = true;

      return;
    }

    fetching.current = true;
    setLoading(true);

    try {
      let start = next;

      do {
        refreshQueued.current = false;

        try {
          const updateList = !!start || drawerOpen.current;
          let page = await getNotifications(start);

          if (!mounted.current) return;

          const newArrival = tracker.current.observe(
            page.notifications,
            !start,
          );

          if (newArrival) {
            arrivalRef.current = newArrival;
            setArrival(newArrival);
            setAnnouncement(newArrival);
          }

          const rows = updateList ? [...page.notifications] : [];

          // Re-read the visible window so new first-page entries cannot create
          // gaps, and read-state changes also reach notifications on older pages.
          for (
            let index = 1;
            !start &&
            updateList &&
            index < pagesLoaded.current &&
            page.nextCursor &&
            drawerOpen.current &&
            mounted.current;
            index++
          ) {
            page = await getNotifications(page.nextCursor);

            if (!mounted.current) return;

            tracker.current.observe(page.notifications, false);
            rows.push(...page.notifications);
          }

          if (!mounted.current) return;

          const append = !!start;

          if (append) pagesLoaded.current++;

          if (updateList && (append || drawerOpen.current)) {
            setItems((current) => (append ? [...current, ...rows] : rows));
            setCursor(page.nextCursor);
          }

          setUnread(page.unreadCount);
          setError("");
        } catch {
          if (mounted.current) setError("Unable to load notifications.");
        }

        start = undefined;
      } while (mounted.current && refreshQueued.current);
    } finally {
      fetching.current = false;

      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();

    const focus = () => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const poll = window.setInterval(focus, 30_000);

    return () => {
      mounted.current = false;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      window.clearInterval(poll);
    };
  }, [load, profileId]);
  useEffect(() => {
    if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      return;

    let client: ReturnType<typeof createClient>;

    try {
      client = createClient(
        env.PUBLIC_SUPABASE_URL,
        env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );
    } catch {
      return;
    }

    let stopped = false,
      connecting = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previousExpiry: number | undefined;

    const reconnect = async () => {
      if (stopped || connecting) return;

      connecting = true;

      if (timer) clearTimeout(timer);

      try {
        if (channel) {
          const old = channel;
          channel = undefined;
          await client.removeChannel(old);
        }

        const credentials = await getNotificationRealtimeToken();

        if (stopped) return;

        const expiry = Date.parse(credentials.expiresAt);

        if (!Number.isFinite(expiry) || expiry <= Date.now())
          throw new Error("Expired token");

        await client.realtime.setAuth(credentials.token);

        if (stopped) return;

        const subscription = client.channel(`notifications:${profileId}`, {
          config: { private: true },
        });
        channel = subscription;
        subscription
          .on("broadcast", { event: NOTIFICATIONS_CHANGED }, ({ payload }) => {
            const canonical =
              payload && typeof payload === "object" && !Array.isArray(payload)
                ? Object.fromEntries(
                    Object.entries(payload).filter(([key]) => key !== "id"),
                  )
                : payload;

            if (
              !stopped &&
              channel === subscription &&
              notificationsChangedSchema.safeParse(canonical).success
            )
              void load();
          })
          .subscribe((status) => {
            if (stopped || channel !== subscription) return;

            if (status === "SUBSCRIBED") void load();
            else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status))
              schedule(10_000);
          });
        const delay = realtimeRefreshDelay(expiry, Date.now(), previousExpiry);
        previousExpiry = expiry;

        if (delay !== null) schedule(delay);
      } catch (cause) {
        if (
          cause instanceof ApiError &&
          isPermanentTokenFailure(cause.status)
        ) {
          if (cause.status === 401 && !stopped)
            window.dispatchEvent(new Event("clemora:session-check"));
        } else schedule(10_000);
      } finally {
        connecting = false;
      }
    };

    const schedule = (delay: number) => {
      if (!stopped) {
        if (timer) clearTimeout(timer);

        timer = setTimeout(() => void reconnect(), delay);
      }
    };

    void reconnect();

    return () => {
      stopped = true;

      if (timer) clearTimeout(timer);

      if (channel) void client.removeChannel(channel);

      void client.removeAllChannels();
    };
  }, [profileId, load]);

  const setDrawerOpen = (value: boolean) => {
    drawerOpen.current = value;
    setOpen(value);
  };

  const select = async (item: Notification) => {
    setBusy(item.id);
    setActionError(null);

    try {
      if (!item.readAt) await markNotificationRead(item.id);

      if (!mounted.current) return;

      if (arrivalRef.current?.id === item.id) {
        if (cardRef.current?.contains(document.activeElement))
          triggerRef.current?.focus();

        arrivalRef.current = null;
        setArrival(null);
      }

      setDrawerOpen(false);
      navigateWorkspace(presentation(item).path);
      void load();
    } catch {
      if (mounted.current)
        setActionError({
          id: item.id,
          message:
            "Unable to mark this notification as read. Select it again to retry.",
        });
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  return (
    <div className="notification-bell">
      <Button
        ref={triggerRef}
        variant="plain"
        className="notification-trigger"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => {
          setActionError(null);
          arrivalRef.current = null;
          setArrival(null);
          setDrawerOpen(true);
          void load();
        }}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <Badge tone="accent" variant="counter" aria-hidden="true">
            {unread}
          </Badge>
        )}
      </Button>
      <span
        className="notification-announcement"
        role="status"
        aria-atomic="true"
      >
        {announcement && (
          <span key={announcement.id}>
            New notification: {presentation(announcement).label}
          </span>
        )}
      </span>
      {arrival && !open && (
        <div className="notification-arrival" ref={cardRef}>
          <div className="notification-arrival-heading">
            <strong>New notification</strong>
            <Button
              variant="plain"
              className="notification-arrival-dismiss"
              aria-label="Dismiss notification"
              onClick={() => {
                if (cardRef.current?.contains(document.activeElement))
                  triggerRef.current?.focus();

                arrivalRef.current = null;
                setArrival(null);
                setActionError(null);
              }}
            >
              <Icon name="close" />
            </Button>
          </div>
          <p>{presentation(arrival).label}</p>
          {actionError?.id === arrival.id && (
            <p role="alert">{actionError.message}</p>
          )}
          <Button
            variant="secondary"
            size="small"
            disabled={!!busy}
            onClick={() => void select(arrival)}
          >
            Open notification
          </Button>
        </div>
      )}
      {open && (
        <Drawer title="Notifications" onClose={() => setDrawerOpen(false)}>
          {error && (
            <p role="alert">
              {error}{" "}
              <Button variant="link" onClick={() => void load()}>
                Retry
              </Button>
            </p>
          )}
          {actionError && <p role="alert">{actionError.message}</p>}
          {loading && !items.length && (
            <p role="status">Loading notifications…</p>
          )}
          {!loading && !error && !items.length && <p>No notifications yet.</p>}
          <ul className="notification-list">
            {items.map((item) => (
              <li key={item.id}>
                <Button
                  variant="plain"
                  className="notification-item"
                  disabled={!!busy}
                  onClick={() => void select(item)}
                >
                  <span>
                    {presentation(item).label}
                    {!item.readAt && <Badge tone="accent">Unread</Badge>}
                  </span>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </Button>
              </li>
            ))}
          </ul>
          {cursor && (
            <Button
              variant="secondary"
              pending={loading}
              onClick={() => void load(cursor)}
            >
              Load more
            </Button>
          )}
        </Drawer>
      )}
    </div>
  );
}
