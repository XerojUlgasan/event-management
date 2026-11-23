import { useEffect, useRef, useState } from "react";
import {
  Button,
  Input,
  Textarea,
  NativeDialog,
  useNotifications,
} from "@event-management/ui";
import {
  MAX_SHOWCASE_DESCRIPTION_LENGTH,
  MAX_SHOWCASE_GALLERY,
  MAX_SHOWCASE_TITLE_LENGTH,
} from "@event-management/contracts/limits/showcase";
import type {
  ShowcaseMediaItem,
  ShowcaseRecord,
} from "@event-management/contracts/showcase";
import {
  uploadShowcaseMedia,
  createShowcase,
  updateShowcase,
  showcaseMediaSrc,
} from "../../../../lib/data/showcases/showcases";

export function ShowcaseEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: ShowcaseRecord | null;
  onClose: () => void;
  onSaved: (record: ShowcaseRecord) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cover, setCover] = useState<ShowcaseMediaItem | null>(
    initial
      ? {
          id: initial.coverMediaId,
          kind: "image",
          mimeType: initial.coverMimeType,
          url: initial.coverUrl,
        }
      : null,
  );
  const [gallery, setGallery] = useState<ShowcaseMediaItem[]>(
    initial?.media ?? [],
  );

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!title.trim()) e.title = "Title is required.";
    else if (title.trim().length > MAX_SHOWCASE_TITLE_LENGTH)
      e.title = `Title must be ${MAX_SHOWCASE_TITLE_LENGTH} characters or fewer.`;

    if (!description.trim()) e.description = "Description is required.";
    else if (description.trim().length > MAX_SHOWCASE_DESCRIPTION_LENGTH)
      e.description = `Description must be ${MAX_SHOWCASE_DESCRIPTION_LENGTH} characters or fewer.`;

    if (!cover) e.cover = "A cover image is required.";

    setErrors(e);

    return Object.keys(e).length === 0;
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploadingCover(true);

    try {
      const result = await uploadShowcaseMedia(file);
      setCover(result);
    } catch (err) {
      notifyError(err, "Cover upload failed. Try again.");
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  }

  async function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(
      0,
      MAX_SHOWCASE_GALLERY - gallery.length,
    );

    if (!files.length) return;

    setUploadingGallery(true);

    try {
      const results = await Promise.allSettled(files.map(uploadShowcaseMedia));

      const uploaded = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );

      setGallery((prev) => [...prev, ...uploaded]);

      const failed = results.find((r) => r.status === "rejected");

      if (failed) notifyError(failed.reason, "One or more uploads failed.");
    } catch (err) {
      notifyError(err, "One or more uploads failed.");
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  }

  function removeGalleryItem(id: string) {
    setGallery((prev) => prev.filter((m) => m.id !== id));
  }

  function moveGalleryItem(id: string, direction: "up" | "down") {
    setGallery((prev) => {
      const idx = prev.findIndex((m) => m.id === id);

      if (idx === -1) return prev;

      const next = [...prev];
      const swap = direction === "up" ? idx - 1 : idx + 1;

      if (swap < 0 || swap >= next.length) return prev;

      [next[idx], next[swap]] = [next[swap], next[idx]];

      return next;
    });
  }

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        coverMediaId: cover!.id,
        mediaIds: gallery.map((m) => m.id),
      };

      let saved: ShowcaseRecord;

      if (initial) {
        saved = await updateShowcase(initial.id, {
          ...payload,
          expectedUpdatedAt: initial.updatedAt,
        });
      } else {
        saved = await createShowcase(payload);
      }

      notify(initial ? "Showcase updated." : "Showcase created as draft.");
      onSaved(saved);
    } catch (err) {
      notifyError(err, "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleCoverChange}
      />
      <Input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        multiple
        style={{ display: "none" }}
        onChange={handleGalleryChange}
      />

      <NativeDialog
        ref={dialogRef}
        className="showcase-editor-dialog"
        onClose={onClose}
        aria-label={initial ? "Edit showcase" : "Create showcase"}
      >
        <div className="showcase-editor-inner">
          <div className="showcase-editor-header">
            <h2>{initial ? "Edit showcase" : "Create showcase"}</h2>
            <Button
              variant="plain"
              className="icon-button"
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
            >
              ✕
            </Button>
          </div>

          <div className="showcase-editor-fields">
            <div className="pe-field">
              <label htmlFor="sc-title">
                Title <span aria-hidden="true">*</span>
              </label>
              <Input
                id="sc-title"
                type="text"
                value={title}
                maxLength={MAX_SHOWCASE_TITLE_LENGTH}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={!!errors.title}
              />
              {errors.title ? (
                <span className="pe-field-error" role="alert">
                  {errors.title}
                </span>
              ) : (
                <span className="pe-field-hint">
                  Up to {MAX_SHOWCASE_TITLE_LENGTH} characters.
                </span>
              )}
            </div>

            <div className="pe-field">
              <label htmlFor="sc-desc">
                Description <span aria-hidden="true">*</span>
              </label>
              <Textarea
                id="sc-desc"
                className="showcase-editor-textarea"
                value={description}
                maxLength={MAX_SHOWCASE_DESCRIPTION_LENGTH}
                rows={4}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!errors.description}
              />
              {errors.description ? (
                <span className="pe-field-error" role="alert">
                  {errors.description}
                </span>
              ) : (
                <span className="pe-field-hint">
                  Up to {MAX_SHOWCASE_DESCRIPTION_LENGTH} characters.
                </span>
              )}
            </div>

            <div className="pe-field">
              <label>
                Cover image <span aria-hidden="true">*</span>
              </label>
              {cover ? (
                <div className="showcase-editor-cover-preview">
                  <img src={showcaseMediaSrc(cover.url)} alt="Cover preview" />
                  <Button variant="secondary" onClick={() => setCover(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="showcase-editor-upload-btn"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {uploadingCover
                    ? "Uploading…"
                    : "Choose cover image (JPEG, PNG, WebP)"}
                </Button>
              )}
              {errors.cover && (
                <span className="pe-field-error" role="alert">
                  {errors.cover}
                </span>
              )}
            </div>

            <div className="pe-field">
              <label>
                Gallery{" "}
                <span className="pe-field-hint-inline">
                  ({gallery.length}/{MAX_SHOWCASE_GALLERY})
                </span>
              </label>
              <div className="showcase-editor-gallery">
                {gallery.map((item, idx) => (
                  <div key={item.id} className="showcase-editor-gallery-item">
                    {item.kind === "image" ? (
                      <img src={showcaseMediaSrc(item.url)} alt="" />
                    ) : (
                      <video src={showcaseMediaSrc(item.url)} muted />
                    )}
                    <div className="showcase-editor-gallery-actions">
                      <Button
                        variant="plain"
                        className="icon-button"
                        aria-label="Move up"
                        disabled={idx === 0}
                        onClick={() => moveGalleryItem(item.id, "up")}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="plain"
                        className="icon-button"
                        aria-label="Move down"
                        disabled={idx === gallery.length - 1}
                        onClick={() => moveGalleryItem(item.id, "down")}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="plain"
                        className="icon-button icon-button-danger"
                        aria-label="Remove"
                        onClick={() => removeGalleryItem(item.id)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
                {gallery.length < MAX_SHOWCASE_GALLERY && (
                  <Button
                    variant="plain"
                    type="button"
                    className="showcase-editor-gallery-add"
                    disabled={uploadingGallery}
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    {uploadingGallery ? "Uploading…" : "+ Add"}
                  </Button>
                )}
              </div>
              <span className="pe-field-hint">
                Images and videos. Up to {MAX_SHOWCASE_GALLERY} items. Reorder
                with ↑ ↓.
              </span>
            </div>
          </div>

          <div className="showcase-editor-footer">
            <Button
              variant="secondary"
              onClick={() => dialogRef.current?.close()}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || uploadingCover || uploadingGallery}
            >
              {saving
                ? "Saving…"
                : initial
                  ? "Save changes"
                  : "Create showcase"}
            </Button>
          </div>
        </div>
      </NativeDialog>
    </>
  );
}
