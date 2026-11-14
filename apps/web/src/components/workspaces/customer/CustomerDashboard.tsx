import { navigateWorkspace } from "../../../lib/navigation/workspace-navigation";
import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Brand,
  Button,
  Dialog,
  Icon,
  type IconName,
  PageHeader,
  Panel,
  Textarea,
  FormField,
  useNotifications,
  notificationErrorMessage,
} from "@event-management/ui";

import { photos } from "../../../demo/catalog/photos";
import { BookingList } from "../../booking-requests/BookingList";
import { CustomerCatalogPage } from "./catalog/CustomerCatalogPage";
import { BookingRequestDialog } from "../../booking-requests/BookingRequestDialog";
import { initialsFromName } from "../../../lib/utils/formatting/name";
import { SignInMethods } from "../../auth/SignInMethods";
import { usePagination } from "../../../lib/pagination/use-pagination";
import { MessagesWorkspace } from "../../messages/MessagesWorkspace";
import {
  mergePolledThread,
  prependOlder,
} from "../../../lib/services/messages/merge-thread";
import { readBookingDraft } from "../../../lib/services/booking-requests/booking-draft";
import {
  getPackageBySlug,
  type PublicPackage,
} from "../../../lib/data/catalog/packages";
import {
  createMyConversation,
  getMyConversations,
  getMyConversation,
  getMyConversationById,
  sendMyMessage,
  type ChatMessage,
  type ChatConversation,
  type ChatThread,
} from "../../../lib/data/messages/conversations";

import { customerPaths, customerTab, type CustomerTab } from "../../app/routes";

export function CustomerDashboard({
  path,
  search,
  onPublic,
  userName,
  userEmail,
  onSignOut,
}: {
  path: string;
  search: string;
  onPublic: () => void;
  userName: string;
  userEmail: string;
  onSignOut: () => void;
}) {
  const { notify, notifyError } = useNotifications();
  const mounted = useRef(true);
  const selection = useRef(0);
  const localMessages = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      selection.current++;
    };
  }, []);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("clemora-message-sent") === "1") {
        sessionStorage.removeItem("clemora-message-sent");
        notify("Message sent.");
      }
    } catch {
      /* The saved message remains visible in the conversation. */
    }
  }, [notify]);
  const tab = customerTab(path);
  const go = (next: CustomerTab) => {
    navigateWorkspace(customerPaths[next]);
  };
  const [messageOpen, setMessageOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [dialogSending, setDialogSending] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [messageThread, setMessageThread] = useState<ChatThread | null>(null);
  const [messageConversations, setMessageConversations] = useState<
    ChatConversation[]
  >([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const pendingBookingReference = new URLSearchParams(search).get("request");
  const [bookingItem, setBookingItem] = useState<PublicPackage | null>(() =>
    new URLSearchParams(search).get("booking") === "resume"
      ? (readBookingDraft()?.item ?? null)
      : null,
  );
  const [bookingResume, setBookingResume] = useState(
    () => new URLSearchParams(search).get("booking") === "resume",
  );
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [threadError, setThreadError] = useState("");
  const lastMessageError = useRef("");
  const [newChatBusy, setNewChatBusy] = useState(false);
  const [listCursor, setListCursor] = useState<string | null>(null);
  const pagination = usePagination("customer-conversations");
  const [listRevision, setListRevision] = useState(0);
  const [threadRevision, setThreadRevision] = useState(0);
  const handledReference = useRef<string | null>(null);
  const listRequest = useRef(0);
  const [historyNotice, setHistoryNotice] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const slug = params.get("book");
    const resume = params.get("booking") === "resume";
    if (resume) {
      setBookingItem(readBookingDraft()?.item ?? null);
      setBookingResume(true);
      return;
    }
    setBookingItem(null);
    setBookingResume(false);
    if (!slug) return;
    let active = true;
    getPackageBySlug(slug)
      .then((item) => {
        if (active) {
          setBookingItem(item);
          setBookingResume(false);
        }
      })
      .catch((cause) => {
        if (active) {
          setBookingItem(null);
          notifyError(cause, "Unable to open the selected package.");
        }
      });
    return () => {
      active = false;
    };
  }, [search, notifyError]);

  const refreshMessages = useCallback(
    async (isActive: () => boolean) => {
      const request = ++listRequest.current;
      const active = () => isActive() && request === listRequest.current;
      try {
        const page = await getMyConversations(pagination.cursor);
        if (!active()) return;
        setListCursor(page.nextCursor);
        setMessageConversations(page.conversations);
        const matching =
          pendingBookingReference &&
          handledReference.current !== pendingBookingReference
            ? await getMyConversations(undefined, pendingBookingReference)
            : null;
        if (!active()) return;
        if (matching) handledReference.current = pendingBookingReference;
        const targetId =
          matching?.conversations[0]?.id ??
          selectedConversationId ??
          page.conversations[0]?.id ??
          null;
        setSelectedConversationId(targetId);
        setMessagesError("");
        lastMessageError.current = "";
      } catch (cause) {
        if (!active()) return;
        const message = notificationErrorMessage(
          cause,
          "Unable to load your messages.",
        );
        setMessagesError(message);
        if (lastMessageError.current !== message) notifyError(message);
        lastMessageError.current = message;
      } finally {
        if (active()) setMessagesLoading(false);
      }
    },
    [
      pagination.cursor,
      pendingBookingReference,
      selectedConversationId,
      notifyError,
    ],
  );

  useEffect(() => {
    if (tab !== "Messages") return;
    let active = true;
    setMessagesLoading(true);
    void refreshMessages(() => active);
    const timer =
      pagination.page === 1
        ? window.setInterval(() => void refreshMessages(() => active), 5000)
        : undefined;
    return () => {
      active = false;
      listRequest.current++;
      if (timer) window.clearInterval(timer);
    };
  }, [tab, refreshMessages, pagination.page, listRevision]);

  useEffect(() => {
    if (tab !== "Messages" || !selectedConversationId) return;
    let active = true;
    const id = selectedConversationId;
    const load = async () => {
      try {
        const thread = await getMyConversationById(id);
        if (!active) return;
        const unacknowledged = new Set(localMessages.current);
        thread.messages.forEach((message) =>
          localMessages.current.delete(message.id),
        );
        setMessageThread((current) => {
          const merged = mergePolledThread(current, thread, unacknowledged);
          if (merged.gap)
            setHistoryNotice(
              "New messages arrived while you were away. Earlier history was reset; load older messages to see it.",
            );
          return merged.thread;
        });
        setThreadError("");
      } catch (cause) {
        if (active)
          setThreadError(
            notificationErrorMessage(
              cause,
              "Unable to load this conversation.",
            ),
          );
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tab, selectedConversationId, notifyError, threadRevision]);

  const showSentInList = (
    conversation: ChatConversation,
    message: ChatMessage,
  ) => {
    setMessageConversations((current) =>
      current.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              status: "active",
              lastMessage: message,
              updatedAt: message.createdAt,
            }
          : item,
      ),
    );
  };

  const appendMessage = (message: ChatMessage, conversationId: string) => {
    setMessageThread((current) => {
      if (!current || current.conversation.id !== conversationId)
        return current;
      if (current.messages.some((item) => item.id === message.id))
        return current;
      return {
        ...current,
        conversation: {
          ...current.conversation,
          lastMessage: message,
          updatedAt: message.createdAt,
        },
        messages: [...current.messages, message],
      };
    });
  };

  const loadOlder = async () => {
    if (!messageThread?.nextCursor || loadingOlder) return;
    const id = messageThread.conversation.id;
    setLoadingOlder(true);
    try {
      const older = await getMyConversationById(id, messageThread.nextCursor);
      older.messages.forEach((message) =>
        localMessages.current.delete(message.id),
      );
      setMessageThread((current) =>
        current?.conversation.id === id
          ? prependOlder(current, older)
          : current,
      );
    } catch (cause) {
      notifyError(cause, "Unable to load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendMessage = async (body: string) => {
    const conversation = messageThread?.conversation;
    if (!conversation) return;
    const previousStatus = conversation.status;
    const result = await sendMyMessage(body, conversation.id);
    localMessages.current.add(result.message.id);
    appendMessage(result.message, conversation.id);
    showSentInList(conversation, result.message);
    // A new message reopens a closed general conversation.
    if (previousStatus === "closed") {
      setMessageThread((current) =>
        current?.conversation.id === conversation.id
          ? {
              ...current,
              conversation: {
                ...current.conversation,
                status: "active",
                closedAt: null,
                packageId: null,
                packageName: null,
                eventType: null,
                eventStartsAt: null,
                eventEndsAt: null,
                guestCount: null,
              },
            }
          : current,
      );
    }
  };

  const startNewChat = async () => {
    if (newChatBusy) return;
    setNewChatBusy(true);
    try {
      const thread = await createMyConversation();
      setSelectedConversationId(thread.conversation.id);
      setMessageThread(thread);
      pagination.reset();
      setListRevision((value) => value + 1);
      setConversationOpen(true);
      notify("New chat started.");
    } catch (cause) {
      notifyError(cause, "Unable to start a new chat.");
    } finally {
      setNewChatBusy(false);
    }
  };

  const selectConversation = async (id: string) => {
    const location = window.location.href;
    const current = ++selection.current;
    const active = () =>
      mounted.current &&
      selection.current === current &&
      window.location.href === location;
    setHistoryNotice("");
    setSelectedConversationId(id);
    setConversationOpen(true);
    setMessagesLoading(true);
    try {
      const thread = await getMyConversationById(id);
      if (!active()) return;
      setMessageThread(thread);
      setMessagesError("");
    } catch (cause) {
      if (!active()) return;
      setMessagesError(notifyError(cause, "Unable to load this conversation."));
    } finally {
      if (active()) setMessagesLoading(false);
    }
  };

  const sendFromDialog = async () => {
    const body = messageDraft.trim();
    if (!body || dialogSending) return;
    setDialogSending(true);
    setDialogError("");
    try {
      const thread = messageThread ?? (await getMyConversation());
      const result = await sendMyMessage(body, thread.conversation.id);
      localMessages.current.add(result.message.id);
      setSelectedConversationId(thread.conversation.id);
      setMessageThread({
        ...thread,
        conversation: {
          ...thread.conversation,
          status: "active",
          lastMessage: result.message,
          updatedAt: result.message.createdAt,
        },
        messages: [...thread.messages, result.message],
      });
      showSentInList(thread.conversation, result.message);
      setMessageDraft("");
      setMessageOpen(false);
      setConversationOpen(true);
      notify("Message sent.");
      go("Messages");
    } catch (cause) {
      setDialogError(notifyError(cause, "Unable to send your message."));
    } finally {
      setDialogSending(false);
    }
  };

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        accountTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);
  const customerTabs: { label: CustomerTab; icon: IconName }[] = [
    { label: "Home", icon: "grid" },
    { label: "My events", icon: "calendar" },
    { label: "Catalogs", icon: "box" },
    { label: "Messages", icon: "users" },
  ];

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <Button
          variant="plain"
          className="customer-brand-button"
          onClick={onPublic}
        >
          <Brand />
        </Button>
        <nav className="customer-nav" aria-label="Customer workspace">
          {customerTabs.map((item) => (
            <Button
              variant="plain"
              className={tab === item.label ? "active" : ""}
              key={item.label}
              aria-current={tab === item.label ? "page" : undefined}
              onClick={() => go(item.label)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="customer-header-actions">
          <div className="customer-account-menu" ref={accountMenuRef}>
            <Button
              variant="plain"
              type="button"
              ref={accountTriggerRef}
              className="customer-profile account-menu-trigger"
              aria-label={`Account menu for ${userName}`}
              aria-expanded={accountMenuOpen}
              aria-controls="customer-account-menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <Avatar initials={initialsFromName(userName)} />
              <span>
                <strong>{userName}</strong>
                <small>Customer</small>
              </span>
              <Icon name="chevron" size={14} />
            </Button>
            {accountMenuOpen && (
              <div className="account-menu" id="customer-account-menu">
                <Button
                  variant="plain"
                  type="button"
                  onClick={() => {
                    go("Profile");
                    setAccountMenuOpen(false);
                  }}
                >
                  Account settings
                </Button>
                <Button variant="plain" type="button" onClick={onSignOut}>
                  Sign out
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="customer-main">
        {tab === "Home" && (
          <div className="customer-content">
            <section className="customer-welcome">
              <div>
                <span className="eyebrow">Your Clemora workspace</span>
                <h1 className="page-title">Welcome back, {userName}</h1>
                <p>Plan an event and keep in touch with our team.</p>
              </div>
            </section>
            <section className="customer-event-hero">
              <div className="customer-event-photo">
                <img src={photos.wedding} alt="Elegant event table setting" />
              </div>
              <div className="customer-event-summary">
                <div className="event-kicker">Your next celebration</div>
                <h2 className="customer-event-title">
                  Let’s bring your plans together
                </h2>
                <p>
                  Browse packages, services, and venues, share your event
                  details, and follow your request as our team reviews it.
                </p>
                <div className="customer-event-actions">
                  <Button onClick={() => go("Catalogs")}>
                    Explore catalogs
                  </Button>
                  <Button variant="secondary" onClick={() => go("My events")}>
                    My events
                  </Button>
                </div>
              </div>
            </section>
            <section className="customer-grid">
              <Panel
                title="Your requests"
                description="See the latest status of your event requests."
              >
                <p>
                  Preferred dates and final prices are reviewed by our team.
                </p>
                <Button variant="secondary" onClick={() => go("My events")}>
                  View my events
                </Button>
              </Panel>
              <Panel
                className="customer-manager-card"
                title="Talk with our team"
                description="Have a question about your plans?"
              >
                <p>
                  Send us a message and we’ll continue the conversation in your
                  workspace.
                </p>
                <Button
                  variant="secondary"
                  className="full-button"
                  onClick={() => setMessageOpen(true)}
                >
                  Send a message
                </Button>
              </Panel>
            </section>
          </div>
        )}
        {tab === "My events" && (
          <div className="customer-content">
            <BookingList
              onExplore={() => go("Catalogs")}
              onOpenChat={(reference: string) => {
                navigateWorkspace(
                  `/app/messages?request=${encodeURIComponent(reference)}`,
                );
              }}
            />
          </div>
        )}

        {tab === "Catalogs" && <CustomerCatalogPage search={search} />}

        {tab === "Profile" && (
          <div className="customer-content">
            <PageHeader
              title="Account settings"
              description="View your account and manage sign-in methods."
            />
            <Panel className="account-summary">
              <h2>Profile</h2>
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{userName}</dd>
                </div>
                <div>
                  <dt>Email address</dt>
                  <dd>{userEmail}</dd>
                </div>
              </dl>
            </Panel>
            <SignInMethods />
          </div>
        )}

        {tab === "Messages" && (
          <div className="customer-messages-view">
            <MessagesWorkspace
              title="Messages"
              viewerRole="customer"
              conversations={messageConversations}
              activeConversation={messageThread?.conversation}
              activeId={messageThread?.conversation.id ?? null}
              onSelect={(id) => void selectConversation(id)}
              messages={messageThread?.messages ?? []}
              listPage={{
                page: pagination.page,
                hasNextPage: !!listCursor,
                pending: messagesLoading,
                onPrevious: () => {
                  setMessagesLoading(true);
                  pagination.previous();
                },
                onNext: () => {
                  setMessagesLoading(true);
                  pagination.next(listCursor);
                },
                onRefresh: () => {
                  setMessagesLoading(true);
                  pagination.reset();
                  setListRevision((value) => value + 1);
                },
              }}
              hasOlder={!!messageThread?.nextCursor}
              loadingOlder={loadingOlder}
              onLoadOlder={() => void loadOlder()}
              historyNotice={historyNotice}
              loading={messagesLoading}
              error={messagesError || threadError}
              onRetry={() => {
                setMessagesLoading(true);
                setThreadRevision((value) => value + 1);
                const location = window.location.href;
                void refreshMessages(() => window.location.href === location);
              }}
              onSend={sendMessage}
              onBack={() => setConversationOpen(false)}
              conversationOpen={conversationOpen}
              onNewChat={startNewChat}
              newChatBusy={newChatBusy}
              listEmpty={{
                title: "No conversation yet",
                body: "Start a conversation with the Clemora team.",
              }}
              threadEmpty={{
                title: "Say hello",
                body: "Ask the team about your event or a package.",
              }}
            />
          </div>
        )}
      </main>

      {messageOpen && (
        <Dialog
          onClose={() => setMessageOpen(false)}
          initialFocus={messageInputRef}
          className="compact-modal"
          eyebrow="Message the Clemora team"
          title="How can we help?"
          intro="Send a message about your event, quotation, or booking. Our team will reply in Messages."
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => setMessageOpen(false)}
                disabled={dialogSending}
              >
                Cancel
              </Button>
              <Button
                onClick={sendFromDialog}
                disabled={!messageDraft.trim() || dialogSending}
              >
                {dialogSending ? "Sending…" : "Send message"}
              </Button>
            </>
          }
        >
          <FormField className="message-compose" label="Message">
            <Textarea
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              placeholder="Write a message"
              maxLength={MAX_MESSAGE_BODY_LENGTH}
              ref={messageInputRef}
            />
          </FormField>
          {dialogError && (
            <p className="messages-send-error" role="alert">
              {dialogError}
            </p>
          )}
        </Dialog>
      )}

      {bookingItem && (
        <BookingRequestDialog
          item={bookingItem}
          resume={bookingResume}
          onClose={() => {
            setBookingItem(null);
            const url = new URL(window.location.href);
            url.searchParams.delete("book");
            url.searchParams.delete("booking");
            navigateWorkspace(`${url.pathname}${url.search}${url.hash}`, true);
          }}
        />
      )}
    </div>
  );
}
