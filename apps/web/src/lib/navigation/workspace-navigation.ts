import { useSyncExternalStore } from "react";

const change = "amac:navigation";

export function customerConversationPath(id: string, quotationId?: string) {
  const path = `/app/messages?conversation=${encodeURIComponent(id)}`;

  return quotationId
    ? `${path}&quotation=${encodeURIComponent(quotationId)}`
    : path;
}

export function customerBookingRequestPath(id: string) {
  return `/app/events?bookingRequest=${encodeURIComponent(id)}`;
}

export function navigateWorkspace(destination: string, replace = false) {
  const url = new URL(destination, window.location.href);

  if (
    url.origin !== window.location.origin ||
    !(url.pathname === "/app" || url.pathname.startsWith("/app/"))
  ) {
    window.location.assign(url.href);

    return;
  }

  if (`${url.pathname}${url.search}${url.hash}` === snapshot()) return;

  window.history[replace ? "replaceState" : "pushState"](
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
  window.dispatchEvent(new Event(change));
}

function snapshot() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  window.addEventListener(change, listener);

  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
    window.removeEventListener(change, listener);
  };
}

export function useWorkspaceLocation(initial: string) {
  const value = useSyncExternalStore(subscribe, snapshot, () => initial);

  const url = new URL(value, "https://amac.invalid");

  return { path: url.pathname, search: url.search, hash: url.hash };
}

export function interceptWorkspaceLink(event: MouseEvent) {
  if (!(
    window.location.pathname === "/app" ||
    window.location.pathname.startsWith("/app/")
  ))
    return;

  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;

  const target =
    event.target instanceof Element ? event.target.closest("a[href]") : null;

  if (
    !(target instanceof HTMLAnchorElement) ||
    target.hasAttribute("download") ||
    (target.target && target.target !== "_self")
  )
    return;

  const url = new URL(target.href, window.location.href);

  if (
    url.origin !== window.location.origin ||
    !(url.pathname === "/app" || url.pathname.startsWith("/app/"))
  )
    return;

  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash
  )
    return;

  event.preventDefault();
  navigateWorkspace(url.href);
}
