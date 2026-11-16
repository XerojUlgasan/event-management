import { useEffect, useId, useState } from "react";
import { Badge } from "@event-management/ui";
import type { KnowledgeStatus } from "@event-management/contracts/catalog-knowledge";

export const knowledgeStatusLabels: Record<KnowledgeStatus, string> = {
  indexed: "Indexed",
  partial: "Partial",
  pending: "Pending",
  "needs-refresh": "Needs refresh",
};
export const knowledgeCoverageHelp =
  "Coverage means the current source identity, preprocessing and model match a successful embedding. It does not re-download photos or prove assistant retrieval.";
export function formatKnowledgeDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
}
export function KnowledgeHelp({ text }: { text: string }) {
  const id = useId();
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    setPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 100),
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width,
    });
  };
  useEffect(() => {
    if (!position) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setPosition(null);
      }
    };
    const scroll = () => setPosition(null);
    window.addEventListener("keydown", dismiss, true);
    window.addEventListener("scroll", scroll, true);
    return () => {
      window.removeEventListener("keydown", dismiss, true);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [position]);
  return (
    <span
      className="knowledge-help"
      tabIndex={0}
      aria-label="Help"
      aria-describedby={position ? id : undefined}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => setPosition(null)}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
    >
      ?
      {position && (
        <span
          id={id}
          role="tooltip"
          className="knowledge-tooltip"
          style={position}
        >
          {text}
        </span>
      )}
    </span>
  );
}
export function KnowledgeStatusBadge({ status }: { status: KnowledgeStatus }) {
  return (
    <Badge tone={status === "indexed" ? "neutral" : "warning"}>
      {knowledgeStatusLabels[status]}
    </Badge>
  );
}
