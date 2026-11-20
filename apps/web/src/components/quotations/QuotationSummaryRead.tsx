import type { Quotation } from "@event-management/contracts/quotations";
import { formatPesosFromMinor } from "../../lib/utils/formatting/money";
import { formatEnPhDateTime } from "../../lib/utils/formatting/dates";
import { QuotationReceipt } from "./QuotationReceipt";
import { QuotationStatusBadge } from "./QuotationStatusBadge";

const formatWhen = (value: string) => formatEnPhDateTime(new Date(value));

export function QuotationSummaryRead({ quotation }: { quotation: Quotation }) {
  return (
    <div className="quotation-offer">
      <div className="quotation-offer-hero">
        <div className="quotation-offer-hero-left">
          <span className="quotation-offer-label">Offer total</span>
          <strong className="quotation-hero-total">
            {formatPesosFromMinor(quotation.totalAmountMinor)}
          </strong>
          <span className="quotation-offer-meta">
            {quotation.sentAt
              ? `v${quotation.version} · Sent ${formatWhen(quotation.sentAt)}`
              : `v${quotation.version} · Not yet sent`}
          </span>
        </div>
        <QuotationStatusBadge status={quotation.status} />
      </div>
      {quotation.revisionReason && quotation.revisionReason !== "Revised" && (
        <p className="quotation-revision-note">
          Revision note: {quotation.revisionReason}
        </p>
      )}
      <QuotationReceipt
        baseAmountMinor={quotation.baseAmountMinor}
        items={quotation.items}
        totalMinor={quotation.totalAmountMinor}
      />
      <p className="quotation-fine">
        This offer does not confirm the booking or reserve the date.
      </p>
    </div>
  );
}
