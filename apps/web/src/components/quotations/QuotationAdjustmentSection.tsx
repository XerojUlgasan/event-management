import {
  MAX_QUOTATION_ITEMS,
  type QuotationItem,
} from "@event-management/contracts/quotations";
import { Button } from "@event-management/ui";
import type { AdminService } from "../../lib/data/catalog/services";
import { QuotationAdjustmentForm } from "./QuotationAdjustmentForm";
import { QuotationAdjustmentRow } from "./QuotationAdjustmentRow";

export function QuotationAdjustmentSection({
  items,
  pendingItem,
  services,
  serviceCursor,
  serviceLoading,
  busy,
  onRemove,
  onStartAdd,
  onUpdatePending,
  onCancelPending,
  onAddPending,
  onRefreshServices,
}: {
  items: QuotationItem[];
  pendingItem: QuotationItem | null;
  services: AdminService[];
  serviceCursor: string | null;
  serviceLoading: boolean;
  busy: boolean;
  onRemove: (index: number) => void;
  onStartAdd: () => void;
  onUpdatePending: (patch: Partial<QuotationItem>) => void;
  onCancelPending: () => void;
  onAddPending: () => void;
  onRefreshServices: (cursor: string) => void;
}) {
  return (
    <div className="quotation-adj-section">
      <div className="quotation-adj-section-header">
        <span>Adjustments</span>
      </div>

      {items.length > 0 && (
        <div className="quotation-adj-list">
          {items.map((line, index) => (
            <QuotationAdjustmentRow
              key={line.id}
              line={line}
              index={index}
              services={services}
              busy={busy}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      )}

      {pendingItem && (
        <QuotationAdjustmentForm
          item={pendingItem}
          services={services}
          serviceCursor={serviceCursor}
          serviceLoading={serviceLoading}
          onChange={onUpdatePending}
          onCancel={onCancelPending}
          onAdd={onAddPending}
          onRefreshServices={() => {
            if (serviceCursor) onRefreshServices(serviceCursor);
          }}
        />
      )}

      {!pendingItem && (
        <div className="quotation-adj-section-footer">
          <Button
            variant="secondary"
            disabled={items.length >= MAX_QUOTATION_ITEMS}
            onClick={onStartAdd}
          >
            Add adjustment
          </Button>
        </div>
      )}
    </div>
  );
}
