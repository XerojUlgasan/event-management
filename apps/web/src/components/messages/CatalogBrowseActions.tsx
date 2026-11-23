import type { CatalogKind } from "@event-management/contracts/catalog-filters";
import { Button } from "@event-management/ui";
import { useState, type RefObject } from "react";
import { ChatCatalogDialog } from "../catalog/ChatCatalogDialog";
import type { ChatMessage } from "../../lib/data/messages/conversations";
import "../../styles/messages/catalog-recommendations.css";

const browseKinds = ["packages", "services"] as const;

export function CatalogBrowseActions({
  message,
  threadRef,
}: {
  message: ChatMessage;
  threadRef: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState<{
    kind: CatalogKind;
    opener: HTMLButtonElement;
    chatScroll: HTMLElement | null;
  } | null>(null);
  const { catalogBrowse } = message;

  if (!Array.isArray(catalogBrowse)) return null;

  const kinds = browseKinds.filter((kind) => catalogBrowse.includes(kind));

  if (kinds.length === 0) return null;

  return (
    <>
      <div className="message-catalog-browse">
        {kinds.map((kind) => (
          <Button
            key={kind}
            variant="secondary"
            size="small"
            className="message-catalog-browse-action"
            aria-haspopup="dialog"
            onClick={(event) =>
              setOpen({
                kind,
                opener: event.currentTarget,
                chatScroll: threadRef.current,
              })
            }
          >
            View {kind} <span aria-hidden="true">↗</span>
          </Button>
        ))}
      </div>
      {open && (
        <ChatCatalogDialog
          kind={open.kind}
          opener={open.opener}
          chatScroll={open.chatScroll}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
