import type { Quotation } from "@event-management/contracts/quotations";
import { Button } from "@event-management/ui";
import { QuotationSummaryRead } from "./QuotationSummaryRead";

export function QuotationOfferCard({
  quotation,
  admin,
  canWrite,
  busy,
  onRevise,
  onSend,
  onAccept,
  onRequestRevision,
}: {
  quotation: Quotation;
  admin: boolean;
  canWrite: boolean;
  busy: boolean;
  onRevise: () => void;
  onSend: () => void;
  onAccept?: () => void;
  onRequestRevision?: () => void;
}) {
  return (
    <div className="quotation-stack">
      <QuotationSummaryRead quotation={quotation} />
      {!admin && quotation.status === "sent" && (
        <div className="quotation-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={onRequestRevision}
          >
            Request revision
          </Button>
          <Button disabled={busy} onClick={onAccept}>
            Accept
          </Button>
        </div>
      )}
      {!admin && quotation.status === "accepted" && (
        <p className="quotation-lede">You accepted this quotation.</p>
      )}
      {admin && canWrite && (
        <div className="quotation-actions">
          <Button variant="secondary" disabled={busy} onClick={onRevise}>
            Revise
          </Button>
          <Button disabled={busy} onClick={onSend}>
            Send to chat
          </Button>
        </div>
      )}
    </div>
  );
}
