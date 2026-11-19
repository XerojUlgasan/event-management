import { useRef, useState } from "react";
import { Button, FormField, Input } from "@event-management/ui";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { uploadCatalogMedia } from "../../lib/data/catalog/media";
import { validateImageFile } from "../../lib/utils/catalog/media-validation";

export function ThumbnailField({
  previewUrl,
  onChange,
  onError,
  onBusyChange,
  disabled = false,
}: {
  /** Absolute or object URL for preview display. Managed by the parent. */
  previewUrl: string | null;
  /** Called with the new mediaId + previewUrl after a successful upload, or
   *  (null, null) when the selection is removed. */
  onChange: (mediaId: string | null, previewUrl: string | null) => void;
  /** Called with a human-readable message when validation or upload fails. */
  onError: (message: string) => void;
  /** Notifies the parent when an upload is in-flight so it can gate submit. */
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const lightboxRef = useRef<HTMLDialogElement>(null);

  const handleFile = async (file: File) => {
    const error = validateImageFile(file);
    if (error) {
      onError(error);
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const preview = URL.createObjectURL(file);
    objectUrlRef.current = preview;

    setUploading(true);
    onBusyChange(true);
    try {
      const result = await uploadCatalogMedia(file);
      onChange(result.id ?? null, preview);
    } catch {
      URL.revokeObjectURL(preview);
      objectUrlRef.current = null;
      onError("Thumbnail upload failed. Try again.");
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  };

  const handleRemove = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    onChange(null, null);
  };

  // stopPropagation prevents the dialog close from bubbling to the file input.
  const openLightbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    lightboxRef.current?.showModal();
  };
  const closeLightbox = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    lightboxRef.current?.close();
  };

  const isDisabled = disabled || uploading;

  return (
    <FormField
      className="full"
      label="Card thumbnail"
      description={`Optional. JPEG, PNG, or WebP, up to ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MiB. A branded default is used when no thumbnail is set. Independent of canvas photos.`}
    >
      {(field) => (
        <div className="thumbnail-field">
          {previewUrl ? (
            /* Thumbnail exists — show preview + Remove only.
               The file input is hidden: the user must Remove before uploading a new one. */
            <div className="thumbnail-field-preview">
              <button
                type="button"
                className="thumbnail-field-thumb-btn"
                onClick={openLightbox}
                aria-label="View thumbnail full size"
                title="Click to view full size"
              >
                <img
                  src={previewUrl}
                  alt="Current card thumbnail"
                  width={80}
                  height={60}
                />
                <span className="thumbnail-field-thumb-hint" aria-hidden="true">
                  View
                </span>
              </button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRemove}
                disabled={isDisabled}
              >
                Remove
              </Button>
            </div>
          ) : (
            /* No thumbnail — show the file input so they can upload one. */
            <Input
              {...field}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isDisabled}
              aria-label="Upload card thumbnail"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (file) void handleFile(file);
              }}
            />
          )}
          {uploading && (
            <small className="thumbnail-field-uploading" aria-live="polite">
              Uploading thumbnail…
            </small>
          )}

          {/* Native dialog lightbox — no extra dependencies */}
          <dialog
            ref={lightboxRef}
            className="thumbnail-lightbox"
            aria-label="Thumbnail preview"
            onClick={(e) => {
              // Close when clicking the backdrop (outside the image).
              if (e.target === e.currentTarget) closeLightbox(e);
            }}
          >
            {previewUrl && (
              <>
                <img
                  src={previewUrl}
                  alt="Card thumbnail full size"
                  className="thumbnail-lightbox-img"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="thumbnail-lightbox-close"
                  onClick={closeLightbox}
                  aria-label="Close preview"
                >
                  ✕ Close
                </Button>
              </>
            )}
          </dialog>
        </div>
      )}
    </FormField>
  );
}
