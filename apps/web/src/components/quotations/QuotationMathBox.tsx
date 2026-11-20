import type { QuotationItem } from "@event-management/contracts/quotations";
import { QuotationReceipt } from "./QuotationReceipt";

export function QuotationMathBox({
  baseAmountMinor,
  items,
  totalMinor,
}: {
  baseAmountMinor: number;
  items: QuotationItem[];
  totalMinor: number;
}) {
  return (
    <>
      <QuotationReceipt
        baseAmountMinor={baseAmountMinor}
        items={items}
        totalMinor={totalMinor}
        standalone
        live
        emphasizeEmpty
      />
      {totalMinor < 0 && (
        <p className="quotation-negative-warn" role="alert">
          The total is below zero. Raise an amount or remove a deduction before
          sending.
        </p>
      )}
    </>
  );
}
