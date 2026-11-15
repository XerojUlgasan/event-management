import { useEffect, useRef, useState } from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { Button, Icon, Input } from "@event-management/ui";
import {
  sendGuestChat,
  type GuestChatHistoryItem,
} from "../../../lib/data/ai-chat/public-chat";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const QUICK_REPLIES = [
  "What packages do you offer?",
  "Do you have wedding packages?",
  "What services are available?",
];

export default function GuestChatbot() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to the newest message after DOM settles.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    // Double rAF ensures layout from markdown rendering is committed.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        body.scrollTop = body.scrollHeight;
      }),
    );
  }, [turns, loading, visible]);

  // Focus the input when the panel is visible.
  useEffect(() => {
    if (visible) inputRef.current?.focus();
  }, [visible]);

  // Cleanup close timer on unmount.
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function handleToggle() {
    if (open) {
      // Closing — animate out, then unmount.
      setVisible(false);
      closeTimer.current = setTimeout(() => setOpen(false), 260);
    } else {
      // Opening — mount, then animate in on next frame.
      setOpen(true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
    }
  }

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);

    const userTurn: ChatTurn = { role: "user", content: trimmed };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);

    const history: GuestChatHistoryItem[] = turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));

    try {
      const { reply } = await sendGuestChat(trimmed, history);
      setTurns([...nextTurns, { role: "assistant", content: reply }]);
    } catch {
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Please try again in a moment, or sign in to chat with our team.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div
          className={`chat-panel${visible ? " chat-panel-open" : ""}`}
          role="dialog"
          aria-label="AI chat assistant"
        >
          <div className="chat-header">
            <span className="ai-icon">
              <Icon name="spark" size={20} />
            </span>
            <span className="chat-header-copy">
              <strong>Clemora Assistant</strong>
              <small>AI-powered event inquiries</small>
            </span>
            <Button
              variant="plain"
              className="chat-close"
              onClick={handleToggle}
              aria-label="Close chat"
            >
              <Icon name="close" size={18} />
            </Button>
          </div>

          <div className="chat-body" ref={bodyRef}>
            <span className="chat-time">
              {new Date().toLocaleDateString("en-PH", {
                month: "long",
                day: "numeric",
              })}
            </span>

            <div className="message">
              Hi! I'm the Clemora Assistant. Ask me about our packages,
              services, or venues — I'm here to help with event inquiries.
            </div>

            {turns.length === 0 && (
              <div className="chat-welcome">
                <div className="quick-replies">
                  {QUICK_REPLIES.map((reply) => (
                    <Button
                      key={reply}
                      variant="plain"
                      onClick={() => send(reply)}
                    >
                      {reply}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn, i) => (
              <div
                key={i}
                className={`message${turn.role === "user" ? " message-own" : ""}`}
              >
                {turn.role === "assistant" ? (
                  <MarkdownPreview
                    source={turn.content}
                    wrapperElement={{ "data-color-mode": "light" }}
                    disableCopy
                    components={{
                      img: ({ src, alt }) => (
                        <img
                          src={src}
                          alt={alt ?? ""}
                          className="chat-catalog-image"
                        />
                      ),
                    }}
                  />
                ) : (
                  turn.content
                )}
              </div>
            ))}

            {loading && (
              <div className="message message-typing-indicator">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            )}
          </div>

          <div className="handover">
            <span>Need more help?</span>
            <a href="/login">Talk to a person →</a>
          </div>

          <div className="chat-input">
            <Input
              ref={inputRef}
              variant="plain"
              type="text"
              value={input}
              placeholder="Type your message…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              disabled={loading}
              aria-label="Message"
            />
            <Button
              variant="plain"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Icon name="arrow" size={18} />
            </Button>
          </div>
        </div>
      )}

      <Button
        variant="plain"
        className={`chat-launcher${open ? " chat-launcher-open" : ""}`}
        onClick={handleToggle}
        aria-label={open ? "Close AI chat assistant" : "Open AI chat assistant"}
      >
        <span className="chat-launcher-spark">
          <Icon name="spark" size={18} />
        </span>
        <span className="chat-launcher-x">
          <Icon name="close" size={20} />
        </span>
        <span className="chat-launcher-label">Ask AI</span>
      </Button>
    </>
  );
}
