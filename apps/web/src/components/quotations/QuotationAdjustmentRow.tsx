import type { QuotationItem } from "@event-management/contracts/quotations";
import { Button } from "@event-management/ui";
import type { AdminService } from "../../lib/data/catalog/services";
import { formatPesosFromMinor } from "../../lib/utils/formatting/money";

export function QuotationAdjustmentRow({
  line,
  index,
  services,
  busy,
  onRemove,
}: {
  line: QuotationItem;
  index: number;
  services: AdminService[];
  busy: boolean;
  onRemove: () => void;
}) {
  const serviceName =
    services.find((service) => service.id === line.serviceId)?.name ?? null;

  const isDeduct = line.direction === "deduct";

  return (
    <div className="quotation-adj-card">
      <div className="quotation-adj-card-main">
        <div className="quotation-adj-card-desc-row">
          <span
            className={`quotation-adj-card-dir ${isDeduct ? "quotation-adj-card-dir--deduct" : "quotation-adj-card-dir--add"}`}
          >
            {isDeduct ? "Deduct" : "Add"}
          </span>
          <span className="quotation-adj-card-desc">
            {line.description || <em>No description</em>}
          </span>
        </div>
        {serviceName && (
          <span className="quotation-adj-card-service">{serviceName}</span>
        )}
      </div>
      <div className="quotation-adj-card-right">
        <span
          className={`quotation-adj-card-amount ${isDeduct ? "quotation-amount-deduct" : "quotation-amount-add"}`}
        >
          {isDeduct ? "−" : "+"}&nbsp;{formatPesosFromMinor(line.amountMinor)}
        </span>
        <Button
          variant="link"
          size="small"
          disabled={busy}
          onClick={onRemove}
          aria-label={`Remove adjustment ${index + 1}`}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
