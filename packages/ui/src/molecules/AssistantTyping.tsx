export function AssistantTyping() {
  return (
    <div
      className="ui-assistant-typing"
      role="status"
      aria-label="AI is preparing a reply"
    >
      <span aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
