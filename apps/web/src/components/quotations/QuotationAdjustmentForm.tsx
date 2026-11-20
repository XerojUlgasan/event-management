import {
  MAX_QUOTATION_AMOUNT_MINOR,
  MAX_QUOTATION_DESCRIPTION_LENGTH,
} from "@event-management/contracts/quotations";
import type { QuotationItem } from "@event-management/contracts/quotations";
import { Button, Input, Select } from "@event-management/ui";
import type { AdminService } from "../../lib/data/catalog/services";
import {
  centavosToPesos,
  pesosToCentavos,
} from "../../lib/utils/formatting/money";

export function QuotationAdjustmentForm({
  item,
  services,
  serviceCursor,
  serviceLoading,
  onChange,
  onCancel,
  onAdd,
  onRefreshServices,
}: {
  item: QuotationItem;
  services: AdminService[];
  serviceCursor: string | null;
  serviceLoading: boolean;
  onChange: (patch: Partial<QuotationItem>) => void;
  onCancel: () => void;
  onAdd: () => void;
  onRefreshServices: () => void;
}) {
  return (
    <div className="quotation-adj-pending">
      <div className="quotation-adj-pending-fields">
        <div className="quotation-adj-pending-field quotation-adj-pending-field--wide">
          <label
            htmlFor="adj-pending-desc"
            className="quotation-adj-pending-label"
          >
            Description
          </label>
          <Input
            id="adj-pending-desc"
            aria-label="New adjustment description"
            placeholder="e.g. Extra setup fee"
            autoFocus
            maxLength={MAX_QUOTATION_DESCRIPTION_LENGTH}
            value={item.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </div>
        <div className="quotation-adj-pending-field">
          <label
            htmlFor="adj-pending-service"
            className="quotation-adj-pending-label"
          >
            Service
          </label>
          <Select
            id="adj-pending-service"
            value={item.serviceId ?? ""}
            onChange={(event) =>
              onChange({ serviceId: event.target.value || null })
            }
          >
            <option value="">No service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
                {service.archivedAt ? " (archived)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="quotation-adj-pending-field">
          <label
            htmlFor="adj-pending-dir"
            className="quotation-adj-pending-label"
          >
            Effect
          </label>
          <Select
            id="adj-pending-dir"
            value={item.direction}
            onChange={(event) =>
              onChange({
                direction: event.target.value === "deduct" ? "deduct" : "add",
              })
            }
          >
            <option value="add">+ Add</option>
            <option value="deduct">− Deduct</option>
          </Select>
        </div>
        <div className="quotation-adj-pending-field">
          <label
            htmlFor="adj-pending-amount"
            className="quotation-adj-pending-label"
          >
            Amount (PHP)
          </label>
          <Input
            id="adj-pending-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            max={centavosToPesos(MAX_QUOTATION_AMOUNT_MINOR)}
            value={centavosToPesos(item.amountMinor) || ""}
            onChange={(event) =>
              onChange({
                amountMinor: pesosToCentavos(Number(event.target.value)),
              })
            }
          />
        </div>
      </div>
      <div className="quotation-pending-actions">
        {serviceCursor && (
          <Button
            variant="secondary"
            disabled={serviceLoading}
            onClick={onRefreshServices}
            className="quotation-pending-refresh"
          >
            Refresh services
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onAdd}>Add</Button>
      </div>
    </div>
  );
}
