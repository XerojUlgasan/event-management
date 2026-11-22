import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, Dialog, FormField, Input } from "@event-management/ui";
import type { IncludedServiceTerms } from "@event-management/contracts/catalog";
import { includedServiceTermsSchema } from "@event-management/contracts/catalog-service-terms";
import { getAdminService } from "../../lib/data/catalog/services";

export function ServiceTermsDialog({
  serviceId,
  terms,
  onSave,
  onClose,
}: {
  serviceId: string;
  terms: IncludedServiceTerms;
  onSave: (terms: IncludedServiceTerms) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(terms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = async () => {
    setBusy(true);
    setError("");

    try {
      const service = await getAdminService(serviceId);
      setValue({
        includedHours: service.includedHours,
        hourlyRatePesos: service.hourlyRatePesos,
      });
    } catch {
      setError("Could not load service defaults. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const result = includedServiceTermsSchema.safeParse(value);

    if (!result.success) {
      setError("Enter positive whole numbers or leave the fields blank.");

      return;
    }

    onSave(result.data);
  };

  return createPortal(
    <Dialog
      title="Included service settings"
      intro="The service base fee is covered by the package price."
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={reset} pending={busy}>
            Reset to defaults
          </Button>
          <Button onClick={save} disabled={busy}>
            Save settings
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <FormField
          label="Included hours"
          description="Leave blank if unspecified."
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              min="1"
              max="2147483647"
              step="1"
              value={value.includedHours ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  includedHours:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          )}
        </FormField>
        <FormField
          label="Excess hourly rate (PHP)"
          description="Leave blank if unspecified."
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              min="1"
              max="2147483647"
              step="1"
              value={value.hourlyRatePesos ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  hourlyRatePesos:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          )}
        </FormField>
      </div>
      {error && <p role="alert">{error}</p>}
    </Dialog>,
    document.body,
  );
}
