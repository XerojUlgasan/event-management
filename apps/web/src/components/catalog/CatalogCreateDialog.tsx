import { useRef, useState, type ReactNode } from "react";
import { Button, Dialog, FormField, Input } from "@event-management/ui";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";

export function CatalogCreateDialog<T extends { name: string }>({
  entity,
  initial,
  onClose,
  onContinue,
  validate,
  renderDetails,
  privateProposal = false,
  uploading = false,
}: {
  entity: "package" | "service";
  privateProposal?: boolean;
  initial: T;
  onClose: () => void;
  onContinue: (content: T) => void;
  validate: (content: T) => string | undefined;
  renderDetails: (content: T, setContent: (content: T) => void) => ReactNode;
  /** When true the Continue button is disabled (e.g. a thumbnail upload is in progress). */
  uploading?: boolean;
}) {
  const [content, setContent] = useState(initial);
  const [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      title={privateProposal ? "Create private package" : `Create ${entity}`}
      initialFocus={nameInput}
      intro={
        privateProposal
          ? "Fill in the details first. Fields marked * are required. Next, add content in the editor. Saving creates a private package for this request."
          : `Fill in the details first. Fields marked * are required. Next, add ${entity === "service" ? "the required service photo and " : ""}content in the editor. Your ${entity} is published only when you save.`
      }
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const message = validate(content);
          setError(message ?? "");

          if (!message) onContinue(content);
        }}
      >
        <div className="form-grid">
          <FormField
            className="full"
            label={`${entity === "package" ? "Package" : "Service"} name *`}
          >
            {(field) => (
              <Input
                {...field}
                ref={nameInput}
                required
                maxLength={MAX_CATALOG_TEXT_LENGTH}
                value={content.name}
                onChange={(event) =>
                  setContent({ ...content, name: event.target.value })
                }
              />
            )}
          </FormField>
        </div>
        {renderDetails(content, setContent)}
        {error && <p role="alert">{error}</p>}
        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Continue to editor"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
