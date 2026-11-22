import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Input, useNotifications } from "@event-management/ui";
import {
  agentSettingsLimits,
  agentSettingsSchema,
  type AgentPreviewMessage,
  type AgentSettings,
} from "@event-management/contracts/ai-agent-settings";
import { previewAgent } from "../../../../lib/data/ai/agent-settings";

export function AgentTestDialog({
  settings,
  onClose,
  busy,
  onBusyChange,
}: {
  settings: AgentSettings;
  onClose: () => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { notifyError } = useNotifications();
  const [messages, setMessages] = useState<AgentPreviewMessage[]>([]);
  const [modes, setModes] = useState<Record<number, "model" | "sample">>({});
  const [question, setQuestion] = useState("");
  const [previewError, setPreviewError] = useState("");
  const previewLog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = previewLog.current;

    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  const ask = async (text: string) => {
    const content = text.trim();

    if (
      !content ||
      busy ||
      messages.length >= agentSettingsLimits.previewMessages
    )
      return;

    const draft = agentSettingsSchema.safeParse(settings);

    if (!draft.success) {
      setPreviewError("Enter a display name before testing.");

      return;
    }

    const next: AgentPreviewMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(next);
    setQuestion("");
    onBusyChange(true);
    setPreviewError("");

    try {
      const result = await previewAgent(draft.data, next);
      setMessages([...next, { role: "assistant", content: result.reply }]);
      setModes((current) => ({ ...current, [next.length]: result.mode }));
    } catch (error) {
      setMessages(messages);
      setQuestion(content);
      setPreviewError("Could not get a reply. Try again.");
      notifyError(error, "Could not test the agent.");
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <Dialog
      title="Test chat"
      intro="Uses your current edits and sample data."
      onClose={onClose}
    >
      <div
        className="agent-preview"
        ref={previewLog}
        role="log"
        aria-label="Test conversation"
      >
        {messages.length === 0 && settings.greeting?.trim() && (
          <div className="agent-preview-message">
            <strong>{settings.displayName || "Assistant"}</strong>
            <p>{settings.greeting}</p>
          </div>
        )}
        {messages.map((message, index) => (
          <div className="agent-preview-message" key={index}>
            <strong>
              {message.role === "user"
                ? "You"
                : settings.displayName || "Assistant"}
              {modes[index] === "sample" && " · Simulated"}
            </strong>
            <p>{message.content}</p>
          </div>
        ))}
        {busy && <p>Thinking…</p>}
        {previewError && <p role="alert">{previewError}</p>}
        {messages.length >= agentSettingsLimits.previewMessages && (
          <p>Test conversation limit reached. Start a new test to continue.</p>
        )}
      </div>
      {messages.length > 0 && (
        <Button
          variant="ghost"
          size="icon"
          icon="refresh"
          title="Start a new test"
          aria-label="Start a new test"
          disabled={busy}
          onClick={() => {
            setMessages([]);
            setModes({});
            setPreviewError("");
          }}
        />
      )}
      {messages.length === 0 && (
        <div className="agent-suggestions">
          <Button
            variant="secondary"
            size="small"
            onClick={() => void ask("Do you have packages for 80 guests?")}
          >
            Packages for 80 guests?
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => void ask("Can I talk to someone?")}
          >
            Can I talk to someone?
          </Button>
        </div>
      )}
      <form
        className="agent-preview-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <Input
          aria-label="Test question"
          maxLength={agentSettingsLimits.previewMessage}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question"
        />
        <Button
          type="submit"
          size="icon"
          icon="arrow"
          aria-label="Send test question"
          title="Send"
          disabled={
            busy ||
            !question.trim() ||
            messages.length >= agentSettingsLimits.previewMessages
          }
        />
      </form>
    </Dialog>
  );
}
