import { Button } from "@event-management/ui";
import { useState } from "react";
import type { ChatMessage } from "../../lib/data/messages/conversations";
import "../../styles/messages/message-images.css";

export function MessageProcessing({
  message,
  onRetry,
}: {
  message: ChatMessage;
  onRetry?: (id: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const processing = message.processing;

  if (!processing || processing.status !== "failed") return null;

  return (
    <div className="message-processing" role="alert">
      Your message was saved, but processing could not be completed.
      {processing.status === "failed" && processing.canRetry && onRetry && (
        <Button
          variant="link"
          pending={pending}
          onClick={async () => {
            setPending(true);
            setError(false);

            try {
              await onRetry(message.id);
            } catch {
              setError(true);
            } finally {
              setPending(false);
            }
          }}
        >
          Retry processing
        </Button>
      )}
      {error && <span>Unable to retry processing. Please try again.</span>}
    </div>
  );
}
