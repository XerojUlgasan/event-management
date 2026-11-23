import { useEffect, useRef, useState } from "react";
import { Button, useNotifications } from "@event-management/ui";
import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import {
  uploadShowcaseMedia,
  createShowcase,
  updateShowcase,
  showcaseMediaSrc,
} from "../../../../lib/data/showcases/showcases";

const MAX_TITLE = 120;
const MAX_DESC = 2000;
const MAX_GALLERY = 12;

type UploadedItem = {
  id: string;
  kind: "image" | "video";
  mimeType: string;
  url: string; // /v1/showcase-media/{id}
};

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
  const previewVideoInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cover, setCover] = useState<UploadedItem | null>(
    initial
      ? { id: initial.coverMediaId, kind: "image", mimeType: initial.coverMimeType, url: initial.coverUrl }
      : null,
  );
  const [previewVideo, setPreviewVideo] = useState<UploadedItem | null>(
    initial?.previewVideoId && initial.previewVideoUrl
      ? { id: initial.previewVideoId, kind: "video", mimeType: "video/mp4", url: initial.previewVideoUrl }
      : null,
  );
  const [gallery, setGallery] = useState<UploadedItem[]>(
    initial?.media.map((m) => ({ id: m.id, kind: m.kind, mimeType: m.mimeType, url: m.url })) ?? [],
  );

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required.";
    else if (title.trim().length > MAX_TITLE) e.title = `Title must be ${MAX_TITLE} characters or fewer.`;
    if (!description.trim()) e.description = "Description is required.";
    else if (description.trim().length > MAX_DESC) e.description = `Description must be ${MAX_DESC} characters or fewer.`;
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
    const files = Array.from(e.target.files ?? []).slice(0, MAX_GALLERY - gallery.length);
    if (!files.length) return;
    setUploadingGallery(true);
    try {
      const results = await Promise.all(files.map(uploadShowcaseMedia));
      setGallery((prev) => [...prev, ...results]);
    } catch (err) {
      notifyError(err, "One or more uploads failed.");
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  }

  async function handlePreviewVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPreview(true);
    try {
      const result = await uploadShowcaseMedia(file);
      setPreviewVideo(result);
    } catch (err) {
      notifyError(err, "Preview video upload failed.");
    } finally {
      setUploadingPreview(false);
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
        previewVideoId: previewVideo?.id ?? null,
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
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleCoverChange} />
      <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple style={{ display: "none" }} onChange={handleGalleryChange} />
      <input ref={previewVideoInputRef} type="file" accept="video/mp4,video/webm" style={{ display: "none" }} onChange={handlePreviewVideoChange} />

      <dialog ref={dialogRef} className="showcase-editor-dialog" onClose={onClose} aria-label={initial ? "Edit showcase" : "Create showcase"}>
        <div className="showcase-editor-inner">
          <div className="showcase-editor-header">
            <h2>{initial ? "Edit showcase" : "Create showcase"}</h2>
            <Button variant="plain" className="icon-button" aria-label="Close" onClick={() => dialogRef.current?.close()}>✕</Button>
          </div>

          <div className="showcase-editor-fields">
            <div className="pe-field">
              <label htmlFor="sc-title">Title <span aria-hidden="true">*</span></label>
              <input id="sc-title" type="text" className="ui-control" value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
              {errors.title ? <span className="pe-field-error" role="alert">{errors.title}</span> : <span className="pe-field-hint">Up to {MAX_TITLE} characters.</span>}
            </div>

            <div className="pe-field">
              <label htmlFor="sc-desc">Description <span aria-hidden="true">*</span></label>
              <textarea id="sc-desc" className="ui-control showcase-editor-textarea" value={description} maxLength={MAX_DESC} rows={4} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!errors.description} />
              {errors.description ? <span className="pe-field-error" role="alert">{errors.description}</span> : <span className="pe-field-hint">Up to {MAX_DESC} characters.</span>}
            </div>

            <div className="pe-field">
              <label>Cover image <span aria-hidden="true">*</span></label>
              {cover ? (
                <div className="showcase-editor-cover-preview">
                  <img src={showcaseMediaSrc(cover.url)} alt="Cover preview" />
                  <Button variant="secondary" onClick={() => setCover(null)}>Remove</Button>
                </div>
              ) : (
                <Button variant="secondary" className="showcase-editor-upload-btn" disabled={uploadingCover} onClick={() => coverInputRef.current?.click()}>
                  {uploadingCover ? "Uploading…" : "Choose cover image (JPEG, PNG, WebP)"}
                </Button>
              )}
              {errors.cover && <span className="pe-field-error" role="alert">{errors.cover}</span>}
            </div>

            <div className="pe-field">
              <label>Hover preview video</label>
              <span className="pe-field-hint" style={{ marginBottom: 8 }}>Optional. Plays when visitors hover the cover on public pages. MP4 or WebM, up to 25 MiB.</span>
              {previewVideo ? (
                <div className="showcase-editor-preview-video">
                  <video src={showcaseMediaSrc(previewVideo.url)} className="showcase-editor-preview-video-thumb" muted loop playsInline
                    onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                    onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                  />
                  <Button variant="secondary" onClick={() => setPreviewVideo(null)}>Remove</Button>
                </div>
              ) : (
                <Button variant="secondary" className="showcase-editor-upload-btn" disabled={uploadingPreview} onClick={() => previewVideoInputRef.current?.click()}>
                  {uploadingPreview ? "Uploading…" : "Choose preview video (MP4 or WebM)"}
                </Button>
              )}
            </div>

            <div className="pe-field">
              <label>Gallery <span className="pe-field-hint-inline">({gallery.length}/{MAX_GALLERY})</span></label>
              <div className="showcase-editor-gallery">
                {gallery.map((item, idx) => (
                  <div key={item.id} className="showcase-editor-gallery-item">
                    {item.kind === "image" ? <img src={showcaseMediaSrc(item.url)} alt="" /> : <video src={showcaseMediaSrc(item.url)} muted />}
                    <div className="showcase-editor-gallery-actions">
                      <Button variant="plain" className="icon-button" aria-label="Move up" disabled={idx === 0} onClick={() => moveGalleryItem(item.id, "up")}>↑</Button>
                      <Button variant="plain" className="icon-button" aria-label="Move down" disabled={idx === gallery.length - 1} onClick={() => moveGalleryItem(item.id, "down")}>↓</Button>
                      <Button variant="plain" className="icon-button icon-button-danger" aria-label="Remove" onClick={() => removeGalleryItem(item.id)}>✕</Button>
                    </div>
                  </div>
                ))}
                {gallery.length < MAX_GALLERY && (
                  <button type="button" className="showcase-editor-gallery-add" disabled={uploadingGallery} onClick={() => galleryInputRef.current?.click()}>
                    {uploadingGallery ? "Uploading…" : "+ Add"}
                  </button>
                )}
              </div>
              <span className="pe-field-hint">Images and videos. Up to {MAX_GALLERY} items. Reorder with ↑ ↓.</span>
            </div>
          </div>

          <div className="showcase-editor-footer">
            <Button variant="secondary" onClick={() => dialogRef.current?.close()} disabled={saving}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving || uploadingCover || uploadingGallery}>
              {saving ? "Saving…" : initial ? "Save changes" : "Create showcase"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
