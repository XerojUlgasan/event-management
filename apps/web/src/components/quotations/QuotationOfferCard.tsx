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
}: {
  quotation: Quotation;
  admin: boolean;
  canWrite: boolean;
  busy: boolean;
  onRevise: () => void;
  onSend: () => void;
}) {
  return (
    <div className="quotation-stack">
      <QuotationSummaryRead quotation={quotation} />
      {!admin && (
        <p className="quotation-lede">Discuss this offer in Messages.</p>
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
