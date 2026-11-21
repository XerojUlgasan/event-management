import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Badge, Button, Drawer, Icon } from "@event-management/ui";
import {
  NOTIFICATIONS_CHANGED,
  notificationsChangedSchema,
  type Notification,
  type NotificationContent,
} from "@event-management/contracts/notifications";
import {
  getNotifications,
  getNotificationRealtimeToken,
  markNotificationRead,
} from "../../lib/data/notifications/notifications";
import { ApiError } from "../../lib/http/request";
import { env } from "../../lib/env/env";
import { navigateWorkspace } from "../../lib/navigation/workspace-navigation";
import {
  isPermanentTokenFailure,
  realtimeRefreshDelay,
} from "../../lib/services/messages/realtime-event";
import { adminBookingRequestPath } from "../app/routes";
import { bookingStatusLabels } from "../booking-requests/BookingRequestDisplay";

function presentation(content: NotificationContent): {
  label: string;
  path: string;
} {
  switch (content.type) {
    case "booking_request_created":
      return {
        label: `New booking request ${content.payload.bookingReference}`,
        path: adminBookingRequestPath(content.payload.bookingRequestId),
      };
    case "booking_status_updated":
      return {
        label: `Booking request ${content.payload.bookingReference}: ${bookingStatusLabels[content.payload.status]}`,
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
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
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
    setActionError("");

    try {
      if (!item.readAt) await markNotificationRead(item.id);

      if (!mounted.current) return;

      setDrawerOpen(false);
      navigateWorkspace(presentation(item).path);
      void load();
    } catch {
      if (mounted.current)
        setActionError(
          "Unable to mark this notification as read. Select it again to retry.",
        );
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  return (
    <>
      <Button
        variant="plain"
        className="notification-trigger"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => {
          setActionError("");
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
          {actionError && <p role="alert">{actionError}</p>}
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
    </>
  );
}
