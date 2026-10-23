import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { EventModels } from "./scene/EventModels";

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function LandingScene() {
  const [supported] = useState(canUseWebGL);
  const scrollProgress = useRef(0);
  const dragRotation = useRef(0);
  const reducedMotion = useRef(false);
  const pointerX = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => { reducedMotion.current = media.matches; };
    onMotionChange();
    media.addEventListener("change", onMotionChange);

    const onScroll = () => {
      const journey = document.querySelector<HTMLElement>(".landing-journey");
      if (!journey) return;
      const travel = Math.max(1, journey.offsetHeight - window.innerHeight);
      scrollProgress.current = Math.min(1, Math.max(0, -journey.getBoundingClientRect().top / travel));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      media.removeEventListener("change", onMotionChange);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!supported) {
    return <div className="landing-scene-fallback" role="img" aria-label="A chair, table, flowers, and photo booth for an event" />;
  }

  return (
    <div
      className="landing-scene-interactive"
      role="img"
      aria-label="Interactive 3D event scene with a chair, table, flowers, and photo booth. Drag horizontally to rotate."
      onPointerDown={(event) => {
        pointerX.current = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (pointerX.current === null) return;
        const difference = event.clientX - pointerX.current;
        dragRotation.current += difference * 0.006;
        pointerX.current = event.clientX;
      }}
      onPointerUp={() => { pointerX.current = null; }}
      onPointerCancel={() => { pointerX.current = null; }}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 2.55, 8.9], fov: 36, near: 0.1, far: 50 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}
      >
        <ambientLight intensity={1.35} />
        <hemisphereLight args={["#f7f6fa", "#9b98a3", 2.0]} />
        <directionalLight castShadow position={[-3, 7, 5]} intensity={3.2} color="#ffffff" shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0002} />
        <directionalLight position={[4, 3, -3]} intensity={1.5} color="#e9e3ef" />
        <EventModels scrollProgress={scrollProgress} dragRotation={dragRotation} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
