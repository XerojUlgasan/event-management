import { Button } from "@event-management/ui";
import "../../styles/messages/suggested-replies.css";

export function SuggestedReplies({
  replies,
  onSelect,
}: {
  replies: string[];
  onSelect: (reply: string) => void;
}) {
  return (
    <div
      className="message-suggested-replies"
      role="group"
      aria-label="Suggested replies"
    >
      {replies.map((reply) => (
        <Button
          key={reply}
          variant="secondary"
          size="small"
          onClick={() => onSelect(reply)}
        >
          {reply}
        </Button>
      ))}
    </div>
  );
}
