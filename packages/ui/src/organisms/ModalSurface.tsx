import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type RefObject,
} from "react";

import { NativeDialog } from "./NativeDialog";

// Mounted Dialog/Drawer own their open state; specialized NativeDialog callers
// continue to own their own lifecycle.
export function ModalSurface({
  onClose,
  initialFocus,
  ...props
}: { onClose: () => void; initialFocus?: RefObject<HTMLElement | null> } & Omit<
  ComponentPropsWithoutRef<"dialog">,
  "open" | "onClose" | "onCancel" | "onPointerDown" | "onClick"
>) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPressed = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
    if (initialFocus?.current && dialog.contains(initialFocus.current))
      initialFocus.current.focus({ preventScroll: true });
    return () => {
      dialog.close();
      // React may detach the dialog before passive cleanup; restore explicitly.
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <NativeDialog
      {...props}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPressed.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && backdropPressed.current)
          onClose();
        backdropPressed.current = false;
      }}
    />
  );
}
