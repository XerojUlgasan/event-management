import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CONVERSATION_MESSAGE_ADDED } from "@event-management/contracts/realtime-events";
import {
  applyRealtimeMessage,
  isCurrentSubscription,
  isIncomingMessage,
  isPermanentTokenFailure,
  realtimeRefreshDelay,
} from "./realtime-event";
import { ApiError } from "../../http/request";
import {
  getRealtimeToken,
  markConversationRead,
  type ChatMessage,
} from "../../data/messages/conversations";
import { config } from "../../../env";

// Desktop keeps the selected thread visible; on narrow screens the inbox can cover it.
export function useThreadVisible(open: boolean) {
  const [wide, setWide] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 761px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");

    const update = () => setWide(media.matches);

    media.addEventListener("change", update);
    update();

    return () => media.removeEventListener("change", update);
  }, []);

  return open || wide;
}

export function useRealtimeThread({
  id,
  enabled,
  admin,
  onMessage,
  onRejoin,
}: {
  id: string | null;
  enabled: boolean;
  admin: boolean;
  onMessage: (message: ChatMessage) => void;
  onRejoin: () => void;
}) {
  const callbacks = useRef({ id, enabled, admin, onMessage, onRejoin });
  callbacks.current = { id, enabled, admin, onMessage, onRejoin };
  useEffect(() => {
    if (
      !id ||
      !enabled ||
      !config.PUBLIC_SUPABASE_URL ||
      !config.PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return;

    let client: ReturnType<typeof createClient>;
    let accessToken: string | null = null;

    try {
      client = createClient(
        config.PUBLIC_SUPABASE_URL,
        config.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
          accessToken: async () => accessToken,
        },
      );
    } catch {
      // Invalid optional configuration leaves the normal polling path active.
      return;
    }

    let stopped = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    let pendingRead: ChatMessage | undefined;
    let reading = false;
    let reconnecting = false;
    let previousExpiry: number | undefined;

    const isCurrent = () =>
      !stopped && isCurrentSubscription(id, admin, callbacks.current);

    const read = async () => {
      if (
        reading ||
        !pendingRead ||
        !isCurrent() ||
        document.visibilityState !== "visible"
      )
        return;

      const message = pendingRead;
      pendingRead = undefined;
      reading = true;

      try {
        await markConversationRead(id, message.id, admin);
      } catch {
        /* Polling remains the recovery path. */
      } finally {
        reading = false;

        if (pendingRead) void read();
      }
    };

    const connect = async () => {
      if (!isCurrent()) return;

      try {
        const credentials = await getRealtimeToken(id);

        if (!isCurrent()) return;

        const expires = Date.parse(credentials.expiresAt);

        if (!Number.isFinite(expires) || expires <= Date.now())
          throw new Error("Expired realtime token");

        accessToken = credentials.token;
        await client.realtime.setAuth(accessToken);

        if (!isCurrent()) return;

        let joined = false;
        const subscription = client.channel(`conversation:${id}`, {
          config: { private: true },
        });
        channel = subscription;
        subscription
          .on(
            "broadcast",
            { event: CONVERSATION_MESSAGE_ADDED },
            ({ payload }) => {
              const { message } = applyRealtimeMessage(null, id, payload);

              if (!message || !isCurrent() || channel !== subscription) return;

              callbacks.current.onMessage(message);

              if (
                document.visibilityState === "visible" &&
                isIncomingMessage(admin, message)
              ) {
                pendingRead = message;
                void read();
              }
            },
          )
          .subscribe((status) => {
            if (!isCurrent() || channel !== subscription) return;

            if (status === "SUBSCRIBED") {
              if (retry) clearTimeout(retry);

              retry = undefined;

              if (!joined && document.visibilityState === "visible")
                callbacks.current.onRejoin();

              joined = true;
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              joined = false;
              scheduleRetry();
            }
          });
        const delay = realtimeRefreshDelay(expires, Date.now(), previousExpiry);
        previousExpiry = expires;

        if (delay !== null) refresh = setTimeout(() => void reconnect(), delay);
      } catch (cause) {
        if (
          cause instanceof ApiError &&
          isPermanentTokenFailure(cause.status)
        ) {
          if (cause.status === 401 && isCurrent())
            window.dispatchEvent(new Event("clemora:session-check"));

          return;
        }

        scheduleRetry();
      }
    };

    const scheduleRetry = () => {
      if (isCurrent() && !retry)
        retry = setTimeout(() => {
          retry = undefined;
          void reconnect();
        }, 10_000);
    };

    const reconnect = async () => {
      if (!isCurrent() || reconnecting) return;

      reconnecting = true;

      if (refresh) clearTimeout(refresh);

      refresh = undefined;

      if (retry) clearTimeout(retry);

      retry = undefined;

      try {
        if (channel) {
          const old = channel;
          channel = undefined;
          await client.removeChannel(old);
        }

        if (isCurrent()) await connect();
      } finally {
        reconnecting = false;
      }
    };

    void connect();

    return () => {
      stopped = true;

      if (retry) clearTimeout(retry);

      if (refresh) clearTimeout(refresh);

      if (channel) void client.removeChannel(channel);

      void client.removeAllChannels();
    };
  }, [id, enabled, admin]);
}

export function startVisiblePolling(load: () => void, enabled: boolean) {
  let timer: ReturnType<typeof setInterval> | undefined;

  const update = () => {
    if (timer) clearInterval(timer);

    timer = undefined;

    if (enabled && document.visibilityState === "visible") {
      load();
      timer = setInterval(load, 15_000);
    }
  };

  const focus = () => {
    if (enabled && document.visibilityState === "visible") load();
  };

  document.addEventListener("visibilitychange", update);
  window.addEventListener("focus", focus);
  // Defer opening the signed-in thread until it is visible: the GET marks reads.
  update();

  return () => {
    if (timer) clearInterval(timer);

    document.removeEventListener("visibilitychange", update);
    window.removeEventListener("focus", focus);
  };
}
