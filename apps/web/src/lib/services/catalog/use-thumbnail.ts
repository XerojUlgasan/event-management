import { useEffect, useRef, useState } from "react";
import {
  catalogMediaSrc,
  deleteCatalogMedia,
  uploadCatalogMedia,
} from "../../data/catalog/media";
import { validateImageFile } from "../../utils/catalog/media-validation";

function discardUpload(id: string | null | undefined) {
  if (id) void deleteCatalogMedia(id).catch(() => {});
}

export function useThumbnail(initialPreviewUrl: string | null = null) {
  // Undefined preserves the saved image. Null explicitly resets it to the default.
  const mediaIdRef = useRef<string | null | undefined>(undefined);
  const activeUpload = useRef<symbol | null>(null);
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      activeUpload.current = null;
    },
    [],
  );

  const change = (id: string | null, url: string | null) => {
    discardUpload(mediaIdRef.current);
    mediaIdRef.current = id;
    setPreviewUrl(url);
  };

  const upload = async (file: File) => {
    if (activeUpload.current) return;

    const validation = validateImageFile(file);
    setError(validation ?? "");

    if (validation) return;

    const current = Symbol();
    activeUpload.current = current;
    setUploading(true);

    try {
      const media = await uploadCatalogMedia(file);

      if (!media.id) throw new Error("Upload returned no thumbnail ID.");

      if (activeUpload.current === current)
        change(media.id, catalogMediaSrc(media.url));
      else discardUpload(media.id);
    } catch {
      if (activeUpload.current === current)
        setError("Thumbnail upload failed. Try again.");
    } finally {
      if (activeUpload.current === current) {
        activeUpload.current = null;
        setUploading(false);
      }
    }
  };

  const useDefault = () => {
    setError("");
    change(null, null);
  };

  const reset = (
    nextPreviewUrl: string | null = null,
    nextMediaId?: string | null,
  ) => {
    activeUpload.current = null;
    mediaIdRef.current = nextMediaId;
    setPreviewUrl(nextPreviewUrl);
    setUploading(false);
    setError("");
  };

  const cancelAndCleanup = () => {
    discardUpload(mediaIdRef.current);
    reset();
  };

  return {
    mediaIdRef,
    previewUrl,
    uploading,
    error,
    upload,
    useDefault,
    reset,
    cancelAndCleanup,
  };
}
