import type { QuotationItem } from "@event-management/contracts/quotations";
import {
  formatPesosFromMinor,
  formatSignedPesosFromMinor,
} from "../../lib/utils/formatting/money";

export function QuotationReceipt({
  baseAmountMinor,
  items,
  totalMinor,
  standalone = false,
  live = false,
  emphasizeEmpty = false,
}: {
  baseAmountMinor: number;
  items: QuotationItem[];
  totalMinor: number;
  standalone?: boolean;
  live?: boolean;
  emphasizeEmpty?: boolean;
}) {
  return (
    <div
      className={`quotation-receipt${standalone ? " quotation-receipt-standalone" : ""}`}
      aria-live={live ? "polite" : undefined}
    >
      <div className="quotation-receipt-row">
        <span>Package base</span>
        <span>{formatPesosFromMinor(baseAmountMinor)}</span>
      </div>
      {items.length > 0 && (
        <span className="quotation-receipt-section-label">Adjustments</span>
      )}
      {items.map((line) => (
        <div className="quotation-receipt-row" key={line.id}>
          <span>
            {line.description ||
              (emphasizeEmpty ? (
                <em>Untitled adjustment</em>
              ) : (
                "Untitled adjustment"
              ))}
          </span>
          <span
            className={
              line.direction === "deduct"
                ? "quotation-amount-deduct"
                : "quotation-amount-add"
            }
          >
            {formatSignedPesosFromMinor(
              line.direction === "deduct"
                ? -line.amountMinor
                : line.amountMinor,
            )}
          </span>
        </div>
      ))}
      <div className="quotation-receipt-row quotation-receipt-total">
        <span>Total</span>
        <span>{formatPesosFromMinor(totalMinor)}</span>
      </div>
    </div>
  );
}
