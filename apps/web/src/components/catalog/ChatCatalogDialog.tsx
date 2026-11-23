import type { CatalogKind } from "@event-management/contracts/catalog-filters";
import { Button, NativeDialog } from "@event-management/ui";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CatalogPreviewContent } from "./CatalogPreviewContent";
import { PublicCatalog } from "./PublicCatalog";
import {
  CatalogNavigationContext,
  type CatalogSelection,
} from "./catalog-navigation-context";
import { lockCatalogScroll } from "./catalog-scroll-lock";
import "../../styles/catalog/chat-catalog-dialog.css";

const titles = {
  packages: "Packages",
  services: "Services",
  package: "Package details",
  service: "Service details",
};

type ScrollPosition = {
  trigger: HTMLElement | null;
  scrollTop: number;
};

type DetailView = {
  item: CatalogSelection;
  from: ScrollPosition;
};

export function ChatCatalogDialog({
  kind,
  opener,
  chatScroll,
  onClose,
}: {
  kind: CatalogKind;
  opener: HTMLButtonElement;
  chatScroll: HTMLElement | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clickedButton = useRef<HTMLButtonElement | null>(null);
  const restorePosition = useRef<ScrollPosition | null>(null);
  const titleId = useId();
  const [details, setDetails] = useState<DetailView[]>([]);
  const detail = details.at(-1);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    const previousChatScroll = chatScroll?.scrollTop ?? 0;
    dialog.showModal();
    const unlockScroll = lockCatalogScroll();
    closeRef.current?.focus();

    return () => {
      dialog.close();
      unlockScroll();
      opener.focus({ preventScroll: true });

      if (chatScroll) chatScroll.scrollTop = previousChatScroll;
    };
  }, [opener, chatScroll]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;

    if (!scroll) return;

    if (restorePosition.current) {
      const { trigger, scrollTop } = restorePosition.current;
      scroll.scrollTop = scrollTop;
      (trigger ?? backRef.current)?.focus({ preventScroll: true });
      restorePosition.current = null;
    } else if (detail) {
      scroll.scrollTop = 0;
      backRef.current?.focus({ preventScroll: true });
    }
  }, [detail]);

  const openDetail = (item: CatalogSelection, trigger: HTMLElement | null) => {
    if (detail?.item.entity === item.entity && detail.item.id === item.id)
      return;

    const from = { trigger, scrollTop: scrollRef.current?.scrollTop ?? 0 };
    setDetails((current) => [...current, { item, from }]);
  };

  const pauseDetailMedia = () => {
    scrollRef.current
      ?.querySelectorAll<HTMLMediaElement>("audio, video")
      .forEach((media) => media.pause());
  };

  return createPortal(
    <NativeDialog
      ref={dialogRef}
      className="chat-catalog-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="chat-catalog-header">
        {detail && (
          <Button
            ref={backRef}
            variant="secondary"
            size="small"
            onClick={() => {
              pauseDetailMedia();
              restorePosition.current = detail.from;
              setDetails((current) => current.slice(0, -1));
            }}
          >
            <span aria-hidden="true">←</span> Back
          </Button>
        )}
        <h2 id={titleId}>{titles[detail?.item.entity ?? kind]}</h2>
        <Button
          ref={closeRef}
          variant="plain"
          className="chat-catalog-close"
          icon="close"
          aria-label="Close catalog"
          onClick={onClose}
        />
      </header>
      <div
        className="chat-catalog-scroll"
        ref={scrollRef}
        onClickCapture={(event) => {
          const target = event.target;
          clickedButton.current =
            target instanceof Element ? target.closest("button") : null;
        }}
      >
        <div className="chat-catalog-list" hidden={!!detail}>
          <PublicCatalog
            kind={kind}
            mode="overview"
            showFilters
            onOpenDetail={openDetail}
          />
        </div>
        <CatalogNavigationContext.Provider
          value={(item) => {
            pauseDetailMedia();
            openDetail(item, clickedButton.current);
          }}
        >
          {details.map((view, index) => (
            <div
              key={`${index}:${view.item.entity}:${view.item.id}`}
              hidden={view !== detail}
            >
              <CatalogPreviewContent selection={view.item} />
            </div>
          ))}
        </CatalogNavigationContext.Provider>
      </div>
    </NativeDialog>,
    document.body,
  );
}
