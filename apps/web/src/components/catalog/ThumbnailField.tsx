import { useId, useRef, useState } from "react";
import {
  Button,
  CatalogThumbnail,
  Input,
  NativeDialog,
} from "@event-management/ui";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";

export type ThumbnailFieldProps = {
  previewUrl: string | null;
  uploading: boolean;
  error: string;
  upload: (file: File) => Promise<void>;
  useDefault: () => void;
};

export function ThumbnailField({
  previewUrl,
  uploading,
  error,
  upload,
  useDefault,
}: ThumbnailFieldProps) {
  const labelId = useId();
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const [unavailableUrl, setUnavailableUrl] = useState<string | null>(null);
  const unavailable = previewUrl !== null && previewUrl === unavailableUrl;
  const canView = previewUrl !== null && !unavailable;

  return (
    <div
      className="thumbnail-field full"
      role="group"
      aria-labelledby={labelId}
    >
      <span className="thumbnail-field-label" id={labelId}>
        Card thumbnail
      </span>
      <div className="thumbnail-field-preview">
        {canView ? (
          <Button
            type="button"
            variant="plain"
            className="thumbnail-field-image thumbnail-field-thumb-btn"
            onClick={() => lightboxRef.current?.showModal()}
            aria-label="View thumbnail full size"
            aria-haspopup="dialog"
          >
            <CatalogThumbnail
              src={previewUrl}
              onImageError={() => setUnavailableUrl(previewUrl)}
            />
            <span className="thumbnail-field-thumb-hint" aria-hidden="true">
              View
            </span>
          </Button>
        ) : (
          <div className="thumbnail-field-image">
            <CatalogThumbnail />
          </div>
        )}
        <div className="thumbnail-field-controls">
          {unavailable && <small role="status">Image unavailable</small>}
          {!previewUrl && <small>AMAC default image</small>}
          <div className="thumbnail-field-actions">
            <Button
              ref={chooseRef}
              type="button"
              variant="secondary"
              pending={uploading}
              aria-describedby={helpId}
              onClick={() => inputRef.current?.click()}
            >
              {uploading
                ? "Uploading…"
                : previewUrl
                  ? "Change image"
                  : "Add image"}
            </Button>
            {previewUrl && (
              <Button
                type="button"
                variant="plain"
                disabled={uploading}
                onClick={() => {
                  useDefault();
                  chooseRef.current?.focus();
                }}
              >
                Use default
              </Button>
            )}
          </div>
          <small className="ui-field-description" id={helpId}>
            JPEG, PNG, or WebP · up to {MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MiB
          </small>
          {uploading && (
            <span className="sr-only" role="status">
              Uploading thumbnail
            </span>
          )}
          {error && (
            <small className="ui-field-error" role="alert">
              {error}
            </small>
          )}
        </div>
      </div>
      <Input
        ref={inputRef}
        variant="plain"
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        aria-label="Choose card thumbnail"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";

          if (file) void upload(file);
        }}
      />
      <NativeDialog
        ref={lightboxRef}
        className="thumbnail-lightbox"
        aria-label="Thumbnail preview"
        onCancel={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (event.target === event.currentTarget)
            lightboxRef.current?.close();
        }}
      >
        {canView && (
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
              onClick={() => lightboxRef.current?.close()}
              aria-label="Close preview"
            >
              Close
            </Button>
          </>
        )}
      </NativeDialog>
    </div>
  );
}
