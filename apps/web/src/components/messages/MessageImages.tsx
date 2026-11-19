import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import {
  MAX_MESSAGE_IMAGES,
  MAX_MESSAGE_IMAGE_PIXELS,
} from "@event-management/contracts/limits/messages";
import { Button, Dialog, Input } from "@event-management/ui";
import { useEffect, useRef, useState } from "react";
import { apiBase } from "../../lib/http/request";
import { messageImageUrl } from "../../lib/utils/messages/image-url";
import type { ChatMessage } from "../../lib/data/messages/conversations";
import "../../styles/messages/message-images.css";

function LocalImage({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? <img src={url} alt={file.name} /> : null;
}

export function MessageAttachments({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  return (
    <div className="message-attachments">
      <Input
        ref={input}
        className="message-file-input"
        tabIndex={-1}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        aria-label="Choose images"
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length + selected.length > MAX_MESSAGE_IMAGES) {
            setError(`Choose up to ${MAX_MESSAGE_IMAGES} images per message.`);
            return;
          }
          if (
            selected.some(
              (file) =>
                !["image/jpeg", "image/png", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > MAX_IMAGE_SIZE_BYTES ||
                file.size === 0,
            )
          ) {
            setError("Choose JPEG, PNG, or WebP images up to 10 MiB each.");
            return;
          }
          setError("");
          onChange([...files, ...selected]);
        }}
      />
      <Button
        variant="secondary"
        size="icon"
        icon="camera"
        aria-label="Attach images"
        title={`JPEG, PNG, or WebP, up to ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MiB and ${MAX_MESSAGE_IMAGE_PIXELS / 1_000_000} megapixels each`}
        disabled={disabled || files.length >= MAX_MESSAGE_IMAGES}
        onClick={() => input.current?.click()}
      />
      {files.length > 0 && (
        <div className="message-image-list">
          {files.map((file, index) => (
            <div className="message-image-draft" key={`${file.name}-${index}`}>
              <LocalImage file={file} />
              <Button
                variant="secondary"
                size="icon"
                icon="close"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              />
            </div>
          ))}
        </div>
      )}
      {error && (
        <span role="alert" className="message-image-error">
          {error}
        </span>
      )}
    </div>
  );
}

export function MessageImages({ message }: { message: ChatMessage }) {
  const [selected, setSelected] = useState<string | null>(null);
  const base = apiBase();
  const images = message.images ?? [];
  return (
    <>
      {(images.length > 0 || (message.pendingFiles?.length ?? 0) > 0) && (
        <div className="message-image-list">
          {images.map((image, index) => {
            const src = messageImageUrl(image.url, base);
            return (
              <Button
                variant="plain"
                type="button"
                className="message-image-button"
                key={image.id}
                onClick={() => setSelected(src)}
                aria-label={`View image ${index + 1}`}
              >
                <img
                  src={src}
                  alt={`Image ${index + 1} attached to message`}
                  loading="lazy"
                />
              </Button>
            );
          })}
          {message.pendingFiles?.map((file, index) => (
            <div className="message-image-button" key={`${file.name}-${index}`}>
              <LocalImage file={file} />
            </div>
          ))}
        </div>
      )}
      {selected && (
        <Dialog
          title="Image"
          className="message-image-dialog"
          onClose={() => setSelected(null)}
        >
          <img src={selected} alt="Message attachment" />
        </Dialog>
      )}
    </>
  );
}
