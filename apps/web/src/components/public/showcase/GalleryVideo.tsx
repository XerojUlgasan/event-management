import { useRef, useCallback } from "react";

type Props = { src: string };

/**
 * Gallery video with hover-to-preview on the /showcases listing page.
 * Hover plays muted and looping; mouse-leave pauses and resets.
 * Controls are always visible so the user can unmute, seek, go fullscreen.
 */
export function GalleryVideo({ src }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = useCallback(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  const handleMouseLeave = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }, []);

  return (
    <div
      className="gallery-video-wrap"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        playsInline
        muted
        loop
        aria-label="Gallery video"
      />
    </div>
  );
}
