import type { Quotation } from "@event-management/contracts/quotations";
import { Button, Pagination } from "@event-management/ui";
import { formatEnPhDateTime } from "../../lib/utils/formatting/dates";
import { formatPesosFromMinor } from "../../lib/utils/formatting/money";
import { QuotationSummaryRead } from "./QuotationSummaryRead";
import { quotationStatusLabel } from "./QuotationStatusBadge";

const formatWhen = (value: string) => formatEnPhDateTime(new Date(value));

export function QuotationHistory({
  quotations,
  expandedId,
  onToggle,
  page,
  hasNextPage,
  onPrevious,
  onNext,
  pending,
  showPagination,
}: {
  quotations: Quotation[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  page: number;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
  pending: boolean;
  showPagination: boolean;
}) {
  if (quotations.length === 0 && page <= 1 && !hasNextPage) return null;

  return (
    <section
      className="quotation-history"
      aria-labelledby="quotation-history-title"
    >
      <h2 id="quotation-history-title">Earlier versions</h2>
      {quotations.map((quotation) => {
        const expanded = expandedId === quotation.id;

        return (
          <div key={quotation.id}>
            <Button
              variant="plain"
              className="quotation-history-item"
              aria-expanded={expanded}
              onClick={() => onToggle(quotation.id)}
            >
              <span>
                <strong>
                  Version {quotation.version} ·{" "}
                  {quotationStatusLabel[quotation.status]}
                </strong>
                <span>
                  {quotation.sentAt
                    ? `Sent ${formatWhen(quotation.sentAt)}`
                    : `Created ${formatWhen(quotation.createdAt)}`}
                </span>
              </span>
              <b>{formatPesosFromMinor(quotation.totalAmountMinor)}</b>
            </Button>
            {expanded && (
              <div className="quotation-history-body">
                <QuotationSummaryRead quotation={quotation} />
              </div>
            )}
          </div>
        );
      })}
      {showPagination && (
        <Pagination
          page={page}
          hasNextPage={hasNextPage}
          onPrevious={onPrevious}
          onNext={onNext}
          pending={pending}
          label="Quotation history"
        />
      )}
    </section>
  );
}
