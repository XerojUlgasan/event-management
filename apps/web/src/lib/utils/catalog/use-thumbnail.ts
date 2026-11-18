import { useRef, useState } from "react";
import { deleteCatalogMedia } from "../../data/catalog/media";

/**
 * Encapsulates all thumbnail state for a create/edit flow.
 *
 * Value semantics:
 *   - `mediaId === undefined`  — untouched this session; omit from the save body
 *                                so the existing DB value is preserved.
 *   - `mediaId === null`       — explicitly cleared by the user; send null to DB.
 *   - `mediaId === "<uuid>"`   — newly uploaded this session; send to DB.
 *
 * The ref mirrors mediaId so that onSave closures always read the latest value
 * without being re-created on every state change (avoids the stale-closure bug).
 *
 * @param initialPreviewUrl  Pass the existing imageUrl (resolved to an absolute
 *                           URL) when opening a listing for edit, so the current
 *                           thumbnail is visible in the field immediately.
 */
export function useThumbnail(initialPreviewUrl: string | null = null) {
  const [mediaId, setMediaId] = useState<string | null | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl);
  const [uploading, setUploading] = useState(false);

  // Ref mirrors mediaId so closures in onSave always see the latest value.
  const mediaIdRef = useRef<string | null | undefined>(undefined);

  /** Call when the upload completes or the user removes the thumbnail. */
  const handleChange = (id: string | null, url: string | null) => {
    mediaIdRef.current = id;
    setMediaId(id);
    setPreviewUrl(url);
  };

  /** Reset to "untouched" state — call when opening a fresh create dialog. */
  const reset = (nextPreviewUrl: string | null = null) => {
    mediaIdRef.current = undefined;
    setMediaId(undefined);
    setPreviewUrl(nextPreviewUrl);
    setUploading(false);
  };

  /**
   * Delete any uploaded-but-unsaved asset, then reset.
   * Call from the create dialog's onClose (AC-07).
   */
  const cancelAndCleanup = () => {
    if (mediaIdRef.current) void deleteCatalogMedia(mediaIdRef.current);
    reset();
  };

  return {
    /** Current media ID: undefined = untouched, null = cleared, string = uploaded. */
    mediaId,
    /** Use this in the render — coerces undefined → null for prop types. */
    mediaIdForField: mediaId ?? null,
    previewUrl,
    uploading,
    /** Pass to onBusyChange in ThumbnailField. */
    setUploading,
    /** Pass to onChange in ThumbnailField. */
    handleChange,
    /** Stable ref — read this inside onSave closures instead of mediaId state. */
    mediaIdRef,
    reset,
    cancelAndCleanup,
  };
}
