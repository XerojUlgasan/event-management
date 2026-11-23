import { Button } from "@event-management/ui";
import { useRef, useState } from "react";
import type { PointerEvent } from "react";

const widgetTools = [
  { type: "photo", icon: "image", label: "Add photo" },
  { type: "markdown", icon: "text", label: "Add Markdown" },
  { type: "video", icon: "video", label: "Add video" },
  { type: "service", icon: "box", label: "Add service" },
] as const;

export type PaletteWidget = (typeof widgetTools)[number]["type"];

export type PalettePoint = { x: number; y: number };

type Gesture = {
  id: number;
  origin: PalettePoint;
  dragging: boolean;
};

const pointAt = (event: PointerEvent<HTMLButtonElement>): PalettePoint => ({
  x: event.clientX,
  y: event.clientY,
});

export function CatalogWidgetPalette({
  disabled,
  onAdd,
  onDrag,
  onDrop,
}: {
  disabled: boolean;
  onAdd: (type: PaletteWidget) => void;
  onDrag: (point: PalettePoint | null) => void;
  onDrop: (type: PaletteWidget, point: PalettePoint) => void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState<PaletteWidget | null>(null);

  const finish = (id: number) => {
    const active = gesture.current;

    if (!active || active.id !== id) return false;

    gesture.current = null;

    if (active.dragging) {
      suppressClick.current = true;
      setDragging(null);
      onDrag(null);
    }

    return active.dragging;
  };

  return (
    <aside className="pe-sidebar" aria-label="Widget palette">
      {widgetTools.map(({ type, icon, label }) => (
        <Button
          key={type}
          variant="secondary"
          size="icon"
          icon={icon}
          aria-label={label}
          title={label}
          disabled={disabled}
          data-dragging={type === dragging || undefined}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;

            suppressClick.current = false;
            gesture.current = {
              id: event.pointerId,
              origin: pointAt(event),
              dragging: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const active = gesture.current;

            if (!active || active.id !== event.pointerId) return;

            const point = pointAt(event);

            if (!active.dragging) {
              if (
                Math.hypot(
                  point.x - active.origin.x,
                  point.y - active.origin.y,
                ) < 5
              )
                return;

              active.dragging = true;
              setDragging(type);
            }

            onDrag(point);
          }}
          onPointerUp={(event) => {
            if (finish(event.pointerId)) onDrop(type, pointAt(event));
          }}
          onPointerCancel={(event) => finish(event.pointerId)}
          onLostPointerCapture={(event) => finish(event.pointerId)}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !gesture.current?.dragging) return;

            event.preventDefault();
            finish(gesture.current.id);
          }}
          onClick={(event) => {
            if (event.detail === 0 || !suppressClick.current) onAdd(type);
          }}
        />
      ))}
    </aside>
  );
}
