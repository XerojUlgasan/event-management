import { navigateWorkspace } from "../../../lib/navigation/workspace-navigation";
import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages";
import { useEffect, useRef, useState } from "react";
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
import { useConversationList } from "../../../lib/services/messages/use-conversation-list";
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
  const localMessages = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
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
  const inbox = useConversationList(getMyConversations, tab === "Messages");
  const {
    conversations: messageConversations,
    setConversations: setMessageConversations,
    loading: messagesLoading,
    error: messagesError,
  } = inbox;
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
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [newChatBusy, setNewChatBusy] = useState(false);
  const [threadRevision, setThreadRevision] = useState(0);
  const handledReference = useRef<string | null>(null);
  const referenceSelection = useRef(0);
  const [referenceAttempt, setReferenceAttempt] = useState(0);
  const [historyNotice, setHistoryNotice] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState("");
  const olderRequest = useRef(0);
  const olderPending = useRef(false);
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

  useEffect(() => {
    if (tab !== "Messages") return;
    if (
      pendingBookingReference &&
      handledReference.current !== pendingBookingReference
    )
      return;
    if (!selectedConversationId && messageConversations[0])
      setSelectedConversationId(messageConversations[0].id);
  }, [
    tab,
    pendingBookingReference,
    selectedConversationId,
    messageConversations,
  ]);

  useEffect(() => {
    if (
      tab !== "Messages" ||
      !pendingBookingReference ||
      handledReference.current === pendingBookingReference
    )
      return;
    let active = true;
    const selection = referenceSelection.current;
    getMyConversations(undefined, pendingBookingReference)
      .then((result) => {
        if (!active || selection !== referenceSelection.current) return;
        handledReference.current = pendingBookingReference;
        setSelectedConversationId(
          result.conversations[0]?.id ?? messageConversations[0]?.id ?? null,
        );
        if (result.conversations.length) setConversationOpen(true);
      })
      .catch((cause) => {
        if (active && selection === referenceSelection.current)
          setThreadError(
            notifyError(cause, "Unable to find this booking conversation."),
          );
      });
    return () => {
      active = false;
    };
  }, [tab, pendingBookingReference, notifyError, referenceAttempt]);

  useEffect(() => {
    if (tab !== "Messages" || !selectedConversationId) return;
    let active = true;
    const id = selectedConversationId;
    olderRequest.current++;
    olderPending.current = false;
    setLoadingOlder(false);
    setOlderError("");
    setThreadLoading(true);
    setMessageThread((current) =>
      current?.conversation.id === id ? current : null,
    );
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
              "New messages arrived while you were away. Earlier history was reset; scroll up to see it.",
            );
          return merged.thread;
        });
        setThreadError("");
        setMessageConversations((current) =>
          current.map((item) => (item.id === id ? thread.conversation : item)),
        );
      } catch (cause) {
        if (active)
          setThreadError(
            notificationErrorMessage(
              cause,
              "Unable to load this conversation.",
            ),
          );
      } finally {
        if (active) setThreadLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      olderRequest.current++;
      window.clearInterval(timer);
    };
  }, [
    tab,
    selectedConversationId,
    notifyError,
    threadRevision,
    setMessageConversations,
  ]);

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
    if (!messageThread?.nextCursor || olderPending.current) return;
    const id = messageThread.conversation.id;
    const cursor = messageThread.nextCursor;
    const request = ++olderRequest.current;
    olderPending.current = true;
    setLoadingOlder(true);
    setOlderError("");
    try {
      const older = await getMyConversationById(id, cursor);
      if (!mounted.current || request !== olderRequest.current) return;
      if (older.nextCursor === cursor)
        throw new Error("Unable to load older messages. Please try again.");
      older.messages.forEach((message) =>
        localMessages.current.delete(message.id),
      );
      setMessageThread((current) =>
        current?.conversation.id === id && current.nextCursor === cursor
          ? prependOlder(current, older)
          : current,
      );
    } catch (cause) {
      if (mounted.current && request === olderRequest.current)
        setOlderError(notifyError(cause, "Unable to load older messages."));
    } finally {
      if (mounted.current && request === olderRequest.current) {
        olderPending.current = false;
        setLoadingOlder(false);
      }
    }
  };

  const sendMessage = async (body: string) => {
    const conversation = messageThread?.conversation;
    if (!conversation || conversation.id !== selectedConversationId)
      throw new Error("Wait for this conversation to load before sending.");
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
    referenceSelection.current++;
    handledReference.current = pendingBookingReference;
    setNewChatBusy(true);
    try {
      const thread = await createMyConversation();
      setSelectedConversationId(thread.conversation.id);
      setMessageThread(thread);
      void inbox.refresh();
      setConversationOpen(true);
      notify("New chat started.");
    } catch (cause) {
      notifyError(cause, "Unable to start a new chat.");
    } finally {
      setNewChatBusy(false);
    }
  };

  const selectConversation = (id: string) => {
    referenceSelection.current++;
    handledReference.current = pendingBookingReference;
    setHistoryNotice("");
    setThreadError("");
    setSelectedConversationId(id);
    setConversationOpen(true);
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
                <span className="eyebrow">Your Styled by AMAC workspace</span>
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
                  Browse packages and services, share your event details, and
                  follow your request as our team reviews it.
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
              activeConversation={
                messageThread?.conversation.id === selectedConversationId
                  ? messageThread.conversation
                  : null
              }
              activeId={selectedConversationId}
              onSelect={(id) => void selectConversation(id)}
              messages={
                messageThread?.conversation.id === selectedConversationId
                  ? messageThread.messages
                  : []
              }
              conversationFeed={{
                hasMore: !!inbox.nextCursor,
                pending: inbox.loadingMore,
                error: inbox.moreError,
                onLoadMore: () => void inbox.loadMore(),
              }}
              hasOlder={
                messageThread?.conversation.id === selectedConversationId &&
                !!messageThread.nextCursor
              }
              loadingOlder={loadingOlder}
              olderError={olderError}
              onLoadOlder={() => void loadOlder()}
              historyNotice={historyNotice}
              loading={messagesLoading || threadLoading}
              error={messagesError || threadError}
              onRetry={() => {
                setThreadRevision((value) => value + 1);
                setReferenceAttempt((value) => value + 1);
                void inbox.refresh();
              }}
              sendDisabled={
                messageThread?.conversation.id !== selectedConversationId ||
                !!threadError
              }
              onSend={sendMessage}
              onBack={() => setConversationOpen(false)}
              conversationOpen={conversationOpen}
              onNewChat={startNewChat}
              newChatBusy={newChatBusy}
              listEmpty={{
                title: "No conversation yet",
                body: "Start a conversation with the Styled by AMAC team.",
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
          eyebrow="Message the Styled by AMAC team"
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
