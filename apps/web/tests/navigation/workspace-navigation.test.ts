import assert from "node:assert/strict";
import test from "node:test";
import {
  navigateWorkspace,
  interceptWorkspaceLink,
} from "../../src/lib/navigation/workspace-navigation";

class FakeWindow extends EventTarget {
  current = new URL("https://amac.test/app/overview");
  entries = [this.current.href];
  index = 0;
  location = {
    get href() {
      return browser.current.href;
    },
    get origin() {
      return browser.current.origin;
    },
    get pathname() {
      return browser.current.pathname;
    },
    get search() {
      return browser.current.search;
    },
    get hash() {
      return browser.current.hash;
    },
    assign: (value: string) => {
      browser.current = new URL(value);
    },
  };
  history = {
    pushState: (_state: unknown, _unused: string, url: string) => {
      this.current = new URL(url, this.current);
      this.entries = [
        ...this.entries.slice(0, this.index + 1),
        this.current.href,
      ];
      this.index++;
    },
    replaceState: (_state: unknown, _unused: string, url: string) => {
      this.current = new URL(url, this.current);
      this.entries[this.index] = this.current.href;
    },
    back: () => {
      this.current = new URL(this.entries[--this.index]);
      this.dispatchEvent(new Event("popstate"));
    },
  };
}

const browser = new FakeWindow();

Object.assign(globalThis, { window: browser });

test("workspace navigation pushes URLs, replaces redirects, and leaves history available for back", () => {
  let changes = 0;
  browser.addEventListener("amac:navigation", () => changes++);
  navigateWorkspace("/app/messages?request=ABC#thread");
  assert.equal(
    browser.current.pathname + browser.current.search + browser.current.hash,
    "/app/messages?request=ABC#thread",
  );
  navigateWorkspace("/app/messages?request=ABC#thread");
  assert.equal(browser.entries.length, 2);
  navigateWorkspace("/app/home", true);
  assert.equal(browser.entries.length, 2);
  assert.equal(changes, 2);
  browser.history.back();
  assert.equal(browser.current.pathname, "/app/overview");
});

class FakeElement {
  closest() {
    return this;
  }
}

class FakeAnchor extends FakeElement {
  target = "";
  constructor(
    public href: string,
    public download = false,
  ) {
    super();
  }
  hasAttribute(name: string) {
    return name === "download" && this.download;
  }
}

Object.assign(globalThis, {
  Element: FakeElement,
  HTMLAnchorElement: FakeAnchor,
});

function click(anchor: FakeAnchor, options: Partial<MouseEvent> = {}) {
  let prevented = false;

  const event = {
    target: anchor,
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => {
      prevented = true;
    },
    ...options,
  } as unknown as MouseEvent;

  interceptWorkspaceLink(event);

  return prevented;
}

test("only ordinary internal workspace links are intercepted", () => {
  assert.equal(
    click(new FakeAnchor("https://amac.test/app/events"), { ctrlKey: true }),
    false,
  );
  assert.equal(
    click(new FakeAnchor("https://amac.test/app/events", true)),
    false,
  );
  assert.equal(click(new FakeAnchor("https://example.test/app/events")), false);
  assert.equal(click(new FakeAnchor("https://amac.test/packages")), false);
  assert.equal(
    click(new FakeAnchor("https://amac.test/app/events?day=1")),
    true,
  );
  assert.equal(
    browser.current.pathname + browser.current.search,
    "/app/events?day=1",
  );
  assert.equal(
    click(new FakeAnchor("https://amac.test/app/events?day=1#details")),
    false,
  );
});
