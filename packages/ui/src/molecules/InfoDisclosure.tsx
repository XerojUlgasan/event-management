import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "../atoms/Button";

/** An information control with a short hint and a persistent detail panel. */
export function InfoDisclosure({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const panelId = useId();

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        open &&
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      )
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (open) {
          setOpen(false);
          trigger.current?.focus();
        }
        setHintDismissed(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      className="ui-info-disclosure"
      ref={root}
      data-hint-dismissed={hintDismissed}
      onMouseEnter={() => setHintDismissed(false)}
    >
      <Button
        ref={trigger}
        variant="secondary"
        size="icon"
        icon="info"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={hintId}
        onFocus={() => setHintDismissed(false)}
        onClick={() => setOpen((value) => !value)}
      />
      <span className="ui-info-disclosure-hint" id={hintId} role="tooltip">
        {hint}
      </span>
      {open && (
        <div className="ui-info-disclosure-panel" id={panelId}>
          {children}
        </div>
      )}
    </div>
  );
}
