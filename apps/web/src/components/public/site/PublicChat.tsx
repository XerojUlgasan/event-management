import {
  ActionLink,
  Button,
  Icon,
  Markdown,
  Textarea,
} from "@event-management/ui";
import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getMe } from "../../../lib/data/auth/session";
import {
  getMyConversation,
  type ChatMessage,
} from "../../../lib/data/messages/conversations";
import {
  getGuestChat,
  sendGuestMessage,
  startGuestChat,
  type GuestThread,
} from "../../../lib/data/messages/guest";
import { ApiError } from "../../../lib/http/request";
import {
  addGuestSentMessages,
  guestRemaining,
  mergeGuestAllowance,
  mergeGuestThread,
  prepareGuestSend,
} from "../../../lib/services/messages/guest-thread";
import { assertCursorMoved } from "../../../lib/services/messages/older-page";

export default function PublicChat() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<GuestThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [outbox, setOutbox] = useState<
    Record<
      string,
      {
        body: string;
        createdAt: string;
        failed: boolean;
        loginRequired?: boolean;
        expired?: boolean;
      }
    >
  >({});
  const outboxRef = useRef(outbox);
  const updateOutbox = (update: (current: typeof outbox) => typeof outbox) => {
    outboxRef.current = update(outboxRef.current);
    setOutbox(outboxRef.current);
  };
  const draftInput = useRef<HTMLTextAreaElement>(null);
  const [olderBusy, setOlderBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [draft, setDraft] = useState("");
  const [newMessages, setNewMessages] = useState(false);
  const messageList = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const scrollOnOpen = useRef(true);
  const lastMessageId = useRef<string | null>(null);
  const olderAnchor = useRef<{ id: string; top: number } | null>(null);
  const threadRef = useRef(thread);
  threadRef.current = thread;
  const polling = useRef(false);
  const opening = useRef(false);
  const revision = useRef(0);
  const openChat = async () => {
    setOpen(true);
    scrollOnOpen.current = true;
    if (opening.current) return;
    opening.current = true;
    setLoading(true);
    setError("");
    setExpired(false);
    try {
      let profile;
      try {
        profile = await getMe();
      } catch (cause) {
        if (!(cause instanceof ApiError && cause.status === 401)) throw cause;
      }
      if (profile?.role === "admin") {
        setThread(null);
        updateOutbox(() => ({}));
        setAdmin(true);
        return;
      }
      if (profile?.role === "customer") {
        setThread(null);
        updateOutbox(() => ({}));
        const result = await getMyConversation();
        window.location.assign(
          `/app/messages?conversation=${encodeURIComponent(result.conversation.id)}`,
        );
        return;
      }
      setAdmin(false);
      // Tabs on this origin serialize the first bootstrap, allowing the next
      // request to use the HttpOnly cookie set by the first response.
      const result = navigator.locks
        ? await navigator.locks.request(
            "clemora-guest-bootstrap",
            startGuestChat,
          )
        : await startGuestChat();
      if (
        threadRef.current &&
        threadRef.current.conversation.id !== result.conversation.id
      ) {
        updateOutbox(() => ({}));
        setDraft("");
      }
      if (threadRef.current?.conversation.id === result.conversation.id) {
        updateOutbox((current) => {
          const next = { ...current };
          result.messages.forEach((message) => delete next[message.id]);
          return next;
        });
      }
      setThread((current) => {
        const merged = mergeGuestThread(current, result);
        if (!current || current.conversation.id !== result.conversation.id)
          return merged;
        return {
          ...merged,
          guest: {
            ...merged.guest,
            remainingMessages: mergeGuestAllowance(
              current.guest.remainingMessages,
              merged.guest.remainingMessages,
            ),
            loginRequired:
              current.guest.loginRequired || merged.guest.loginRequired,
          },
        };
      });
    } catch {
      setError("Unable to open chat. Please try again.");
    } finally {
      opening.current = false;
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!open || loading || !thread || expired) return;
    const id = thread.conversation.id;
    let active = true;
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      const started = revision.current;
      try {
        const result = await getGuestChat(id);
        if (active && started === revision.current) {
          updateOutbox((current) => {
            const next = { ...current };
            result.messages.forEach((message) => delete next[message.id]);
            return next;
          });
          setThread((current) => {
            const merged = mergeGuestThread(current, result);
            if (!current || current.conversation.id !== id) return merged;
            return {
              ...merged,
              guest: {
                ...merged.guest,
                remainingMessages: mergeGuestAllowance(
                  current.guest.remainingMessages,
                  merged.guest.remainingMessages,
                ),
                loginRequired:
                  current.guest.loginRequired || merged.guest.loginRequired,
              },
            };
          });
          setError("");
        }
      } catch (cause) {
        if (active && started === revision.current) {
          if (cause instanceof ApiError && cause.status === 410) {
            setExpired(true);
            setError(
              "This conversation has expired. Start a new chat to continue.",
            );
          } else setError("Unable to refresh messages. We will keep trying.");
        }
      } finally {
        polling.current = false;
      }
    };
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open, loading, thread?.conversation.id, expired]);
  useLayoutEffect(() => {
    const element = messageList.current;
    if (!open || loading || admin || !thread || !element) return;
    const last =
      Object.keys(outbox).at(-1) ?? thread.messages.at(-1)?.id ?? null;
    const anchor = olderAnchor.current;
    if (anchor) {
      const row = [
        ...element.querySelectorAll<HTMLElement>("[data-message-id]"),
      ].find((item) => item.dataset.messageId === anchor.id);
      if (row)
        element.scrollTop += row.getBoundingClientRect().top - anchor.top;
      olderAnchor.current = null;
    } else if (scrollOnOpen.current || nearBottom.current) {
      element.scrollTop = element.scrollHeight;
      nearBottom.current = true;
      setNewMessages(false);
    } else if (last && last !== lastMessageId.current) {
      setNewMessages(true);
    }
    scrollOnOpen.current = false;
    lastMessageId.current = last;
  }, [open, loading, admin, thread, outbox]);
  const deliver = async (
    conversationId: string,
    item: { body: string; requestId: string; createdAt: string },
  ) => {
    updateOutbox((current) => ({
      ...current,
      [item.requestId]: {
        body: item.body,
        createdAt: item.createdAt,
        failed: false,
      },
    }));
    revision.current++;
    try {
      const result = await sendGuestMessage(
        conversationId,
        item.body,
        item.requestId,
      );
      setThread((current) =>
        current && current.conversation.id === conversationId
          ? {
              ...current,
              guest: {
                ...result.guest,
                remainingMessages: mergeGuestAllowance(
                  current.guest.remainingMessages,
                  result.guest.remainingMessages,
                ),
                loginRequired:
                  current.guest.loginRequired || result.guest.loginRequired,
              },
              messages: addGuestSentMessages(
                current.messages,
                result.assistantMessage
                  ? [result.message, result.assistantMessage]
                  : [result.message],
              ),
            }
          : current,
      );
      updateOutbox((current) => {
        const next = { ...current };
        delete next[item.requestId];
        return next;
      });
      if (threadRef.current?.conversation.id !== conversationId) return;
      if (result.assistantError)
        setError(
          "Your message was sent, but an automatic reply is unavailable. Our team can still respond.",
        );
    } catch (cause) {
      if (threadRef.current?.conversation.id !== conversationId) return;
      updateOutbox((current) =>
        current[item.requestId]
          ? {
              ...current,
              [item.requestId]: {
                body: item.body,
                createdAt: item.createdAt,
                failed: true,
                expired: cause instanceof ApiError && cause.status === 410,
                loginRequired:
                  cause instanceof ApiError &&
                  cause.status === 409 &&
                  cause.code === "login_required",
              },
            }
          : current,
      );
      if (cause instanceof ApiError && cause.status === 410) {
        setExpired(true);
        setError(
          "This conversation has expired. Start a new chat to continue.",
        );
      } else if (
        cause instanceof ApiError &&
        cause.status === 409 &&
        cause.code === "login_required"
      ) {
        setThread((current) =>
          current?.conversation.id === conversationId
            ? {
                ...current,
                guest: {
                  ...current.guest,
                  loginRequired: true,
                  remainingMessages: 0,
                },
              }
            : current,
        );
        setError("Sign in to continue this conversation.");
      }
    }
  };
  const send = () => {
    const current = threadRef.current;
    const item = prepareGuestSend(null, draft, () => crypto.randomUUID());
    if (
      !current ||
      !item ||
      expired ||
      current.guest.loginRequired ||
      guestRemaining(
        current.guest.remainingMessages,
        Object.keys(outboxRef.current).length,
      ) === 0
    )
      return;
    setDraft("");
    setError("");
    void deliver(current.conversation.id, {
      ...item,
      createdAt: new Date().toISOString(),
    });
    draftInput.current?.focus();
  };
  const loadOlder = async () => {
    const current = threadRef.current;
    if (!current?.nextCursor || olderBusy) return;
    setOlderBusy(true);
    const started = ++revision.current;
    try {
      const older = await getGuestChat(
        current.conversation.id,
        current.nextCursor,
      );
      assertCursorMoved(older.nextCursor, current.nextCursor);
      if (started === revision.current) {
        updateOutbox((items) => {
          const next = { ...items };
          older.messages.forEach((message) => delete next[message.id]);
          return next;
        });
        const row =
          messageList.current?.querySelector<HTMLElement>("[data-message-id]");
        if (row?.dataset.messageId)
          olderAnchor.current = {
            id: row.dataset.messageId,
            top: row.getBoundingClientRect().top,
          };
        setThread((value) => mergeGuestThread(value, older, true));
      }
    } catch {
      setError("Unable to load older messages. Please try again.");
    } finally {
      setOlderBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="plain"
        className="amac-text-link public-chat-trigger"
        onClick={() => void openChat()}
      >
        Chat with us
      </Button>
      {open && (
        <section
          className="chat-panel public-chat-panel"
          aria-label="Chat with Styled by AMAC"
        >
          <header className="chat-header">
            <div className="chat-header-copy">
              <strong>Chat with us</strong>
              <small>Styled by AMAC</small>
            </div>
            <Button
              variant="plain"
              className="chat-close"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" />
            </Button>
          </header>
          <div
            ref={messageList}
            className="chat-body chat-messages"
            aria-live="polite"
            onScroll={(event) => {
              const el = event.currentTarget;
              nearBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              if (nearBottom.current) setNewMessages(false);
            }}
          >
            {loading && <p>Opening chat…</p>}
            {admin && (
              <p>
                You are signed in as an administrator.{" "}
                <a href="/app/messages">Open Messages</a>.
              </p>
            )}
            {!loading && !admin && !thread && (
              <>
                <p>Chat is unavailable.</p>
                <Button variant="secondary" onClick={() => void openChat()}>
                  Try again
                </Button>
              </>
            )}
            {!loading && !admin && thread && (
              <>
                {!expired && (
                  <p>
                    <ActionLink
                      href={`/login?guest=${encodeURIComponent(thread.conversation.id)}&createRequest=1`}
                    >
                      Create booking request
                    </ActionLink>
                  </p>
                )}
                {thread.nextCursor && (
                  <Button
                    variant="link"
                    disabled={olderBusy}
                    onClick={() => void loadOlder()}
                  >
                    {olderBusy ? "Loading…" : "Load older messages"}
                  </Button>
                )}
                {!thread.messages.length && !Object.keys(outbox).length && (
                  <p>Say hello. Ask us about your event or a package.</p>
                )}
                {addGuestSentMessages(
                  thread.messages,
                  Object.entries(outbox).map(([id, item]): ChatMessage => ({
                    id,
                    body: item.body,
                    createdAt: item.createdAt,
                    quotationId: null,
                    senderId: null,
                    senderRole: "customer",
                    senderName: "You",
                    readAt: null,
                  })),
                ).map((message) => {
                  const item = outbox[message.id];
                  return (
                    <div
                      key={message.id}
                      data-message-id={message.id}
                      className={`message ${message.senderRole === "customer" ? "customer-message" : "bot"}`}
                    >
                      <strong>
                        {message.senderRole === "customer"
                          ? "You"
                          : message.senderName}
                      </strong>
                      <div className="public-chat-message-body">
                        <Markdown source={message.body} variant="message" />
                      </div>
                      {item?.failed && (
                        <div className="message-delivery-error" role="alert">
                          {item.expired ? (
                            "Not sent. This conversation has expired."
                          ) : item.loginRequired ? (
                            "Not sent. Sign in to continue."
                          ) : (
                            <>
                              Delivery could not be confirmed.{" "}
                              {!expired && (
                                <Button
                                  variant="link"
                                  onClick={() =>
                                    void deliver(thread.conversation.id, {
                                      body: item.body,
                                      requestId: message.id,
                                      createdAt: item.createdAt,
                                    })
                                  }
                                >
                                  Retry
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {thread.guest.loginRequired && !expired && (
                  <div className="chat-signin">
                    <strong>Continue your conversation</strong>
                    <p>
                      Sign in or create an account to keep chatting. Your
                      conversation will be waiting for you.
                    </p>
                    <a
                      className="button button-primary"
                      href={`/login?guest=${encodeURIComponent(thread.conversation.id)}`}
                    >
                      Sign in to continue
                    </a>
                  </div>
                )}
                {expired && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      updateOutbox(() => ({}));
                      setThread(null);
                      setDraft("");
                      void openChat();
                    }}
                  >
                    Start a new chat
                  </Button>
                )}
              </>
            )}
            {error && (
              <p className="chat-error" role="alert">
                {error}
              </p>
            )}
          </div>
          {newMessages && !loading && !admin && thread && (
            <Button
              variant="link"
              onClick={() => {
                if (messageList.current)
                  messageList.current.scrollTop =
                    messageList.current.scrollHeight;
                nearBottom.current = true;
                setNewMessages(false);
              }}
            >
              View new messages
            </Button>
          )}
          {!loading &&
            !admin &&
            thread &&
            !thread.guest.loginRequired &&
            !expired && (
              <form
                className="chat-input"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <Textarea
                  variant="plain"
                  rows={1}
                  ref={draftInput}
                  aria-label="Your message"
                  placeholder="Write a message…"
                  value={draft}
                  maxLength={MAX_MESSAGE_BODY_LENGTH}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      send();
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={
                    !draft.trim() ||
                    guestRemaining(
                      thread.guest.remainingMessages,
                      Object.keys(outbox).length,
                    ) === 0
                  }
                  aria-label="Send message"
                  icon="arrow"
                ></Button>
              </form>
            )}
          {!loading &&
            !admin &&
            thread &&
            !thread.guest.loginRequired &&
            !expired && (
              <div className="handover">
                {guestRemaining(
                  thread.guest.remainingMessages,
                  Object.keys(outbox).length,
                )}{" "}
                guest messages remaining
              </div>
            )}
        </section>
      )}
    </>
  );
}
