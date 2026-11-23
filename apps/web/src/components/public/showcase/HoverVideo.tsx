import { useRef, useState, useCallback } from "react";

type Props = {
  /** URL of the video to play on hover. */
  src: string;
  /** Static image shown while not hovering. */
  posterSrc: string;
  /** Additional class on the root wrapper div. */
  className?: string;
  children?: React.ReactNode;
};

/**
 * Renders a cover image that swaps to a muted looping video on hover.
 * Always renders as a <div> — the caller is responsible for the link wrapper.
 * No browser native overlay appears because `controls` is never set.
 */
export function HoverVideo({ src, posterSrc, className = "", children }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const handleMouseEnter = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setPlaying(true);
    v.play().catch(() => {});
  }, []);

  const handleMouseLeave = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
  }, []);

  return (
    <div
      className={`hv-wrap${className ? ` ${className}` : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img
        className="hv-img"
        src={posterSrc}
        alt=""
        loading="lazy"
        style={{ opacity: playing ? 0 : 1 }}
      />
      <video
        ref={videoRef}
        className="hv-video"
        src={src}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        disableRemotePlayback
        aria-hidden="true"
        style={{ opacity: playing ? 1 : 0 }}
      />
      {children}
    </div>
  );
}
