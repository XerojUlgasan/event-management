import type { QuotationStatus } from "@event-management/contracts/quotations";
import { Badge } from "@event-management/ui";

export const quotationStatusLabel: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  superseded: "Replaced",
};

const statusTone: Record<
  QuotationStatus,
  "warning" | "info" | "success" | "neutral"
> = {
  draft: "warning",
  sent: "info",
  accepted: "success",
  superseded: "neutral",
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <Badge tone={statusTone[status]}>{quotationStatusLabel[status]}</Badge>
  );
}
