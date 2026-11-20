import type {
  Quotation,
  QuotationItem,
} from "@event-management/contracts/quotations";
import { Button } from "@event-management/ui";
import type { AdminService } from "../../lib/data/catalog/services";
import { QuotationAdjustmentSection } from "./QuotationAdjustmentSection";
import { QuotationMathBox } from "./QuotationMathBox";
import { QuotationStatusBadge } from "./QuotationStatusBadge";

export function QuotationDraftEditor({
  draft,
  revisingOffer,
  previousDraftVersion,
  items,
  pendingItem,
  services,
  serviceCursor,
  serviceLoading,
  busy,
  onRemoveItem,
  onStartAdd,
  onUpdatePending,
  onCancelPending,
  onAddPending,
  onRefreshServices,
  onCancel,
  onSave,
}: {
  draft: Quotation | null;
  revisingOffer: Quotation | null;
  previousDraftVersion: number | null;
  items: QuotationItem[];
  pendingItem: QuotationItem | null;
  services: AdminService[];
  serviceCursor: string | null;
  serviceLoading: boolean;
  busy: boolean;
  onRemoveItem: (index: number) => void;
  onStartAdd: () => void;
  onUpdatePending: (patch: Partial<QuotationItem>) => void;
  onCancelPending: () => void;
  onAddPending: () => void;
  onRefreshServices: (cursor: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const baseAmountMinor = revisingOffer
    ? revisingOffer.baseAmountMinor
    : draft!.baseAmountMinor;

  const totalMinor =
    baseAmountMinor +
    items.reduce(
      (sum, line) =>
        sum + (line.direction === "add" ? line.amountMinor : -line.amountMinor),
      0,
    );

  return (
    <fieldset className="quotation-stack" disabled={busy}>
      <div className="quotation-offer-head">
        <div>
          <h2 className="quotation-offer-title">
            Version {revisingOffer ? revisingOffer.version + 1 : draft!.version}
          </h2>
          <div className="quotation-meta-stack">
            {revisingOffer && (
              <p className="quotation-meta">
                Revision of version {revisingOffer.version}.
              </p>
            )}
            {!revisingOffer && previousDraftVersion != null && (
              <p className="quotation-meta">
                Draft revision of version {previousDraftVersion}.
              </p>
            )}
          </div>
        </div>
        <QuotationStatusBadge status="draft" />
      </div>

      <QuotationAdjustmentSection
        items={items}
        pendingItem={pendingItem}
        services={services}
        serviceCursor={serviceCursor}
        serviceLoading={serviceLoading}
        busy={busy}
        onRemove={onRemoveItem}
        onStartAdd={onStartAdd}
        onUpdatePending={onUpdatePending}
        onCancelPending={onCancelPending}
        onAddPending={onAddPending}
        onRefreshServices={onRefreshServices}
      />

      <QuotationMathBox
        baseAmountMinor={baseAmountMinor}
        items={items}
        totalMinor={totalMinor}
      />

      <p className="quotation-fine">
        This offer does not confirm the booking or reserve the date.
      </p>

      <div className="quotation-actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={onSave}>
          Save adjustments
        </Button>
      </div>
    </fieldset>
  );
}
