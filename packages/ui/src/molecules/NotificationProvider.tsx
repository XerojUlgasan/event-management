import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Icon } from "../atoms/Icon";
import { Toast, type ToastTone } from "./Toast";

type Notification = { id: number; message: string; tone: ToastTone };
type Notifications = {
  notify: (message: string, tone?: ToastTone) => void;
  notifyError: (cause: unknown, fallback?: string) => string;
};
const NotificationContext = createContext<Notifications | null>(null);

export function notificationErrorMessage(cause: unknown, fallback = "Something went wrong. Try again."): string {
  if (cause instanceof Error && cause.message.trim()) return cause.message;
  if (typeof cause === "string" && cause.trim()) return cause;
  return fallback;
}

export function useNotifications(): Notifications {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const nextId = useRef(0);
  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    setItems(current => current.some(item => item.message === message) ? current : [...current, { id: nextId.current++, message, tone }]);
  }, []);
  const notifyError = useCallback((cause: unknown, fallback?: string) => {
    const message = notificationErrorMessage(cause, fallback);
    notify(message, "danger");
    return message;
  }, [notify]);
  const dismiss = useCallback((id: number) => setItems(current => current.filter(item => item.id !== id)), []);
  const value = useMemo(() => ({ notify, notifyError }), [notify, notifyError]);

  useEffect(() => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    setHost(element);
    return () => { element.remove(); };
  }, []);

  useEffect(() => {
    if (!host || items.length === 0) return;
    // Only observe while feedback is visible. Maintain modal opening order so
    // sibling and nested native dialogs both receive the same portal host.
    let modals = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog:modal"));
    const placeHost = () => {
      modals = modals.filter(dialog => dialog.isConnected && dialog.matches(":modal"));
      const focusedModal = document.activeElement?.closest("dialog:modal");
      if (focusedModal instanceof HTMLDialogElement && modals.includes(focusedModal)) {
        modals = [...modals.filter(dialog => dialog !== focusedModal), focusedModal];
      }
      const parent = modals.at(-1) ?? document.body;
      if (host.parentElement !== parent) parent.appendChild(host);
    };
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof HTMLDialogElement && record.target.matches(":modal")) {
          modals = [...modals.filter(dialog => dialog !== record.target), record.target];
        }
        for (const node of record.addedNodes) {
          if (!(node instanceof Element) || node === host) continue;
          const added = [node, ...node.querySelectorAll("dialog:modal")];
          for (const dialog of added) if (dialog instanceof HTMLDialogElement && dialog.matches(":modal") && !modals.includes(dialog)) modals.push(dialog);
        }
      }
      placeHost();
    });
    placeHost();
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("focusin", placeHost);
    return () => { observer.disconnect(); document.removeEventListener("focusin", placeHost); };
  }, [host, items.length > 0]);

  return <NotificationContext.Provider value={value}>
    {children}
    {host && createPortal(<div className="ui-notification-stack">{items.map(item => <NotificationToast key={item.id} item={item} dismiss={dismiss} />)}</div>, host)}
  </NotificationContext.Provider>;
}

function NotificationToast({ item, dismiss }: { item: Notification; dismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (item.tone === "danger" || hovered || focused) return;
    const timer = window.setTimeout(() => dismiss(item.id), 6000);
    return () => window.clearTimeout(timer);
  }, [item.id, item.tone, hovered, focused, dismiss]);
  return <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <Toast tone={item.tone}><span>{item.message}</span><button type="button" className="ui-notification-dismiss" aria-label="Dismiss notification" onClick={() => dismiss(item.id)}><Icon name="close" /></button></Toast>
  </div>;
}
