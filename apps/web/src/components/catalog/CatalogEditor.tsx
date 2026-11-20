import { lockCatalogScroll } from "./catalog-scroll-lock";
import {
  Button,
  Dialog,
  Icon,
  Input,
  NativeDialog,
  Select,
  useNotifications,
  CatalogGridGuides,
  CatalogGridRuler,
  CATALOG_GRID,
  catalogGridStyle,
} from "@event-management/ui";
import {
  CATALOG_COLUMNS,
  MAX_CATALOG_SECTIONS,
  MAX_CATALOG_WIDGETS,
  MAX_WIDGET_MARKDOWN_LENGTH,
} from "@event-management/contracts/catalog";
import {
  MAX_CATALOG_TEXT_LENGTH,
  MAX_CATALOG_WIDGET_ROWS,
  MAX_CATALOG_WIDGET_Y,
} from "@event-management/contracts/limits/catalog";
import { MAX_VIDEO_SIZE_BYTES } from "@event-management/contracts/limits/videos";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createPortal } from "react-dom";
import GridLayout from "react-grid-layout/legacy";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import type {
  CatalogSection,
  CatalogWidget,
} from "@event-management/contracts/catalog";
import { deleteCatalogMedia } from "../../lib/data/catalog/media";
import { validateCatalogCanvas } from "../../lib/utils/catalog/canvas-validation";
import { validateImageFile } from "../../lib/utils/catalog/media-validation";
import {
  unreferencedUploadIds,
  uploadPendingCatalogMedia,
} from "../../lib/services/catalog/save-catalog-media";
import { WidgetContent } from "./CatalogContent";
import { PackageMediaSettings } from "./PackageMediaSettings";
import { ServiceTermsDialog } from "./ServiceTermsDialog";
import { CatalogReferencePickerDialog } from "./CatalogReferencePickerDialog";
import "react-grid-layout/css/styles.css";
import "../../styles/catalog/package-editor.css";

const uuid = () => crypto.randomUUID();

export const newCatalogSection = (): CatalogSection => ({
  id: uuid(),
  title: "",
  widgets: [],
});

const newSection = newCatalogSection;

const widget = (type: CatalogWidget["type"], y: number): CatalogWidget => ({
  id: uuid(),
  type,
  x: 0,
  y,
  w: 6,
  h: 5,
  markdown:
    type === "markdown" ? "## Your heading\n\nTell your story here." : "",
  media: null,
  alt: "",
  caption: "",
  autoplay: false,
});

const sectionRows = (widgets: readonly { y: number; h: number }[]) =>
  Math.max(0, ...widgets.map((w) => w.y + w.h));

type ActiveLayout = {
  sectionId: string;
  items: readonly { i: string; x: number; y: number; w: number; h: number }[];
};

const HISTORY_LIMIT = 50;
const TEXT_BURST_MS = 700;

const isTextField = (target: EventTarget | null) => {
  if (target instanceof HTMLTextAreaElement) return true;

  if (target instanceof HTMLInputElement)
    return ![
      "checkbox",
      "radio",
      "file",
      "range",
      "color",
      "button",
      "submit",
      "reset",
    ].includes(target.type);

  return target instanceof HTMLElement && target.isContentEditable;
};

function MediaWidget({
  widget,
  onSelectFile,
}: {
  widget: CatalogWidget;
  onSelectFile: (file?: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="pe-media-preview">
      <WidgetContent
        widget={widget}
        editor
        mediaPlaceholder={
          <Button
            variant="plain"
            type="button"
            className="ui-catalog-empty pe-choose-media"
            onClick={() => input.current?.click()}
          >
            Add a {widget.type === "photo" ? "photo" : "video"}
          </Button>
        }
      />
      <Input
        variant="plain"
        ref={input}
        type="file"
        hidden
        accept={
          widget.type === "photo"
            ? "image/jpeg,image/png,image/webp"
            : "video/mp4,video/webm"
        }
        onChange={(event) => {
          onSelectFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function MarkdownSettings({
  widget,
  onChange,
  onClose,
}: {
  widget: CatalogWidget;
  onChange: (markdown: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();

    return () => {
      node?.close();
      trigger?.focus();
    };
  }, []);

  return createPortal(
    <NativeDialog
      ref={dialog}
      className="pe-media-dialog pe-markdown-dialog"
      aria-label="Edit Markdown"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <header>
        <h2>Edit Markdown</h2>
        <Button
          variant="plain"
          aria-label="Close Markdown editor"
          onClick={onClose}
        >
          <Icon name="close" size={20} />
        </Button>
      </header>
      <div className="pe-media-dialog-body" data-color-mode="light">
        <MDEditor
          textareaProps={{ "aria-label": "Markdown content" }}
          value={widget.markdown}
          onChange={(value) =>
            onChange((value || "").slice(0, MAX_WIDGET_MARKDOWN_LENGTH))
          }
          height={360}
          visibleDragbar={false}
          previewOptions={{ rehypePlugins: [rehypeSanitize] }}
        />
      </div>
      <footer>
        <p>Only content that fits the widget will appear on the page.</p>
        <Button onClick={onClose}>Done</Button>
      </footer>
    </NativeDialog>,
    document.body,
  );
}

type CanvasContent = {
  name: string;
  sections: CatalogSection[];
  addonServices?: { serviceId: string }[];
};

export function CatalogEditor<T extends CanvasContent>({
  initial,
  entity,
  onClose,
  onSaved,
  onSave,
  validate,
  validateCanvas,
  renderDetails,
  renderPreview,
  saveLabel = "Save changes",
  nameMaxLength = MAX_CATALOG_TEXT_LENGTH,
  privateProposal = false,
}: {
  initial: T;
  entity: "package" | "service";
  onClose: () => void;
  onSaved: () => void;
  onSave: (content: T) => Promise<void>;
  validate?: (content: T) => string | undefined;
  validateCanvas?: (content: T) => string | undefined;
  renderDetails: (
    content: T,
    setContent: Dispatch<SetStateAction<T>>,
  ) => ReactNode;
  renderPreview: (content: T, mode: "customer" | "card") => ReactNode;
  nameMaxLength?: number;
  saveLabel?: string;
  privateProposal?: boolean;
}) {
  const { notify, notifyError } = useNotifications();
  const title = privateProposal
    ? "Private package"
    : entity[0].toUpperCase() + entity.slice(1);

  const [content, setContentState] = useState<T>(() =>
    structuredClone(initial),
  );

  const contentRef = useRef(content);
  const historyRef = useRef<{ past: T[]; future: T[] }>({
    past: [],
    future: [],
  });
  const lastEdit = useRef<{ at: number; kind: "text" | "action" }>({
    at: 0,
    kind: "action",
  });

  const shortcuts = useRef({ undo: () => {}, redo: () => {}, busy: false });

  const [canUndo, setCanUndo] = useState(false),
    [canRedo, setCanRedo] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [markdownEditing, setMarkdownEditing] = useState<{
    sectionId: string;
    widgetId: string;
  } | null>(null);
  const [referenceEditing, setReferenceEditing] = useState<{
    sectionId: string;
    widgetId: string;
  } | null>(null);
  const [termsEditing, setTermsEditing] = useState<{
    sectionId: string;
    widgetId: string;
  } | null>(null);
  const [targetSection, setTargetSection] = useState(0);
  const [activeLayout, setActiveLayout] = useState<ActiveLayout | null>(null);
  const [gridReset, setGridReset] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState(false),
    [preview, setPreview] = useState(false),
    [mode, setMode] = useState<"customer" | "card">("customer"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const [mediaEditing, setMediaEditing] = useState<{
    sectionId: string;
    widgetId: string;
  } | null>(null);

  // Content-only history. Publishing a snapshot is cheap because each change
  // replaces the section or widget objects it touches and reuses the rest.
  const applyContent = (next: T) => {
    contentRef.current = next;
    setContentState(next);
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(historyRef.current.future.length > 0);
  };

  const setContent = (update: T | ((current: T) => T)) => {
    const previous = contentRef.current;
    const next =
      typeof update === "function"
        ? (update as (current: T) => T)(previous)
        : update;

    if (next === previous) return;

    const typing = isTextField(document.activeElement);
    const now = Date.now();

    // One burst of typing in a field becomes a single undo step.
    if (!(
      typing &&
      lastEdit.current.kind === "text" &&
      now - lastEdit.current.at < TEXT_BURST_MS
    )) {
      historyRef.current.past = [...historyRef.current.past, previous].slice(
        -HISTORY_LIMIT,
      );
      historyRef.current.future = [];
    }

    lastEdit.current = { at: now, kind: typing ? "text" : "action" };
    applyContent(next);
  };

  const undo = () => {
    const past = historyRef.current.past;

    if (busy || !past.length) return;

    historyRef.current.past = past.slice(0, -1);
    historyRef.current.future = [
      contentRef.current,
      ...historyRef.current.future,
    ].slice(0, HISTORY_LIMIT);
    lastEdit.current = { at: 0, kind: "action" };
    applyContent(past[past.length - 1]);
  };

  const redo = () => {
    const [next, ...future] = historyRef.current.future;

    if (busy || !next) return;

    historyRef.current.future = future;
    historyRef.current.past = [
      ...historyRef.current.past,
      contentRef.current,
    ].slice(-HISTORY_LIMIT);
    lastEdit.current = { at: 0, kind: "action" };
    applyContent(next);
  };

  useEffect(() => {
    shortcuts.current = { undo, redo, busy };
  });
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.isComposing
      )
        return;

      const key = event.key.toLowerCase();
      const undoStep = key === "z" && !event.shiftKey;
      const redoStep = key === "y" || (key === "z" && event.shiftKey);

      if (!undoStep && !redoStep) return;

      const target = event.target instanceof HTMLElement ? event.target : null;

      // Text fields keep their native text undo; other dialogs keep their own shortcuts.
      const targetDialog = target?.closest("dialog");
      const detailsDialog = detailsRef.current?.closest("dialog");

      if (
        isTextField(target) ||
        !targetDialog ||
        (targetDialog !== dialogRef.current && targetDialog !== detailsDialog)
      )
        return;

      event.preventDefault();

      if (shortcuts.current.busy) return;

      if (redoStep) shortcuts.current.redo();
      else shortcuts.current.undo();
    };

    window.addEventListener("keydown", onShortcut);

    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const displayContent = {
    ...content,
    sections: content.sections.map((s) => ({
      ...s,
      widgets: s.widgets.map((w) =>
        localUrls[w.id] && w.media
          ? { ...w, media: { ...w.media, url: localUrls[w.id] } }
          : w,
      ),
    })),
  };

  const editingMedia =
    mediaEditing &&
    displayContent.sections
      .find((s) => s.id === mediaEditing.sectionId)
      ?.widgets.find((w) => w.id === mediaEditing.widgetId);

  const editingReference =
    referenceEditing &&
    displayContent.sections
      .find((s) => s.id === referenceEditing.sectionId)
      ?.widgets.find((w) => w.id === referenceEditing.widgetId);

  const editingTerms =
    termsEditing &&
    displayContent.sections
      .find((s) => s.id === termsEditing.sectionId)
      ?.widgets.find((w) => w.id === termsEditing.widgetId);

  const editingMarkdown =
    markdownEditing &&
    displayContent.sections
      .find((s) => s.id === markdownEditing.sectionId)
      ?.widgets.find((w) => w.id === markdownEditing.widgetId);

  const pending = useRef<string[]>([]),
    objectUrls = useRef<string[]>([]);
  const [width, setWidth] = useState(800),
    gridContainer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = gridContainer.current;

    if (!node) return;

    setWidth(node.clientWidth);

    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [preview]);
  useEffect(
    () => () => {
      objectUrls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );

  const setSection = (id: string, fn: (s: CatalogSection) => CatalogSection) =>
    setContent((c) => ({
      ...c,
      sections: c.sections.map((s) => (s.id === id ? fn(s) : s)),
    }));

  const changeWidget = (
    sid: string,
    id: string,
    patch: Partial<CatalogWidget>,
  ) =>
    setSection(sid, (s) => ({
      ...s,
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));

  const keyboardLayout = (
    section: CatalogSection,
    current: CatalogWidget,
    event: React.KeyboardEvent,
  ) => {
    if (event.target !== event.currentTarget) return;

    if (
      busy ||
      width < 520 ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;

    event.preventDefault();
    const dx =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    const next = event.shiftKey
      ? { ...current, w: current.w + dx, h: current.h + dy }
      : { ...current, x: current.x + dx, y: current.y + dy };

    if (
      next.x < 0 ||
      next.y < 0 ||
      next.y > MAX_CATALOG_WIDGET_Y ||
      next.w < Math.min(3, current.w) ||
      next.h < Math.min(4, current.h) ||
      next.h > MAX_CATALOG_WIDGET_ROWS ||
      next.x + next.w > CATALOG_COLUMNS
    )
      return;

    if (
      section.widgets.some(
        (other) =>
          other.id !== current.id &&
          next.x < other.x + other.w &&
          next.x + next.w > other.x &&
          next.y < other.y + other.h &&
          next.y + next.h > other.y,
      )
    )
      return;

    changeWidget(section.id, current.id, {
      x: next.x,
      y: next.y,
      w: next.w,
      h: next.h,
    });
  };

  const commitLayout = (
    section: CatalogSection,
    items: ActiveLayout["items"],
  ) => {
    setActiveLayout(null);

    if (
      items.some(
        (item) =>
          item.y > MAX_CATALOG_WIDGET_Y || item.h > MAX_CATALOG_WIDGET_ROWS,
      )
    ) {
      setGridReset((previous) => ({
        ...previous,
        [section.id]: (previous[section.id] ?? 0) + 1,
      }));
      notify(
        `A widget can start at row ${MAX_CATALOG_WIDGET_Y + 1} at most and span up to ${MAX_CATALOG_WIDGET_ROWS} rows.`,
        "danger",
      );

      return;
    }

    setSection(section.id, (s) => ({
      ...s,
      widgets: s.widgets.map((w) => ({
        ...w,
        ...(({ x, y, w: width, h }) => ({ x, y, w: width, h }))(
          items.find((item) => item.i === w.id) || w,
        ),
      })),
    }));
  };

  const reorderMobile = (
    section: CatalogSection,
    id: string,
    direction: number,
  ) => {
    const sorted = [...section.widgets].sort((a, b) => a.y - b.y || a.x - b.x);

    const index = sorted.findIndex((w) => w.id === id),
      target = index + direction;

    if (index < 0 || target < 0 || target >= sorted.length) return;

    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    let y = 0;

    const widgets = sorted.map((w) => {
      const next = { ...w, x: 0, y };
      y += w.h;

      return next;
    });

    setSection(section.id, (s) => ({ ...s, widgets }));
  };

  const selectFile = (
    sid: string,
    w: CatalogWidget,
    file?: File,
  ): string | undefined => {
    if (!file) return;

    if (w.type === "photo") {
      const photoError = validateImageFile(file);

      if (photoError) return photoError;
    } else {
      const max = MAX_VIDEO_SIZE_BYTES;
      const types = ["video/mp4", "video/webm"];

      if (!types.includes(file.type)) return "Choose an MP4 or WebM video.";

      if (!file.size || file.size > max)
        return `File must be ${Math.floor(max / 1024 / 1024)} MiB or smaller.`;
    }

    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    setLocalUrls((f) => ({ ...f, [w.id]: url }));
    setFiles((f) => ({ ...f, [w.id]: file }));
    changeWidget(sid, w.id, {
      media: {
        kind: w.type === "photo" ? "image" : "video",
        source: "upload",
        url,
      },
    });
  };

  const cancel = () => {
    if (busy || !window.confirm("Discard unsaved changes?")) return;

    void Promise.allSettled(pending.current.map(deleteCatalogMedia));
    onClose();
  };

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const unlockScroll = lockCatalogScroll();
    dialogRef.current?.showModal();
    document.querySelector<HTMLInputElement>(".pe-name input")?.focus();

    return () => {
      dialogRef.current?.close();
      unlockScroll();
      trigger?.focus();
    };
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;

    const trap = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" ||
        !dialog ||
        (event.target instanceof Element &&
          event.target.closest("dialog") !== dialog)
      )
        return;

      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0);

      if (!controls.length) {
        event.preventDefault();

        return;
      }

      const first = controls[0],
        last = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog?.addEventListener("keydown", trap);

    return () => dialog?.removeEventListener("keydown", trap);
  }, []);

  const save = async () => {
    if (!content.name.trim()) {
      setError(notifyError(validate?.(content) || `Enter a ${entity} name.`));
      setSettings(false);
      setPreview(false);
      nameRef.current?.focus();

      return;
    }

    const validationError = validate?.(content);

    if (validationError) {
      setError(notifyError(validationError));
      setSettings(true);

      return;
    }

    const canvasError =
      validateCanvas?.(content) ||
      validateCatalogCanvas(content.sections, new Set(Object.keys(files)));

    if (canvasError) {
      setError(notifyError(canvasError));
      setSettings(false);
      setPreview(false);

      return;
    }

    setBusy(true);
    setError("");

    try {
      const next = await uploadPendingCatalogMedia(
        content,
        files,
        (widgetId, uploaded) => {
          if (uploaded.id) pending.current.push(uploaded.id);

          setContent((c) => ({
            ...c,
            sections: c.sections.map((s) => ({
              ...s,
              widgets: s.widgets.map((old) =>
                old.id === widgetId ? { ...old, media: uploaded } : old,
              ),
            })),
          }));
          setFiles((f) => {
            const copy = { ...f };
            delete copy[widgetId];

            return copy;
          });
        },
      );

      const uploadedCanvasError = validateCatalogCanvas(next.sections);

      if (uploadedCanvasError) throw new Error(uploadedCanvasError);

      await onSave(next);
      void Promise.allSettled(
        unreferencedUploadIds(next.sections, pending.current).map(
          deleteCatalogMedia,
        ),
      );
      pending.current = [];
      notify(`${title} saved.`);
      onSaved();
    } catch (e) {
      setError(notifyError(e, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <NativeDialog
      ref={dialogRef}
      className="pe-overlay"
      aria-label={`${title} editor`}
      onCancel={(event) => {
        event.preventDefault();

        if (settings) setSettings(false);
        else cancel();
      }}
    >
      <fieldset disabled={busy} className="pe-editor-fields">
        <header className="pe-bar">
          <Button
            variant="plain"
            className="pe-back"
            onClick={cancel}
            aria-label={`Back to ${entity}s`}
          >
            ←
          </Button>
          <label className="pe-name">
            <small>{title.toUpperCase()} NAME</small>
            <Input
              variant="plain"
              ref={nameRef}
              aria-label={`${title} name`}
              maxLength={nameMaxLength}
              value={content.name}
              placeholder={`Untitled ${entity}`}
              onChange={(e) => setContent({ ...content, name: e.target.value })}
            />
          </label>
          <div className="pe-bar-actions">
            <Button
              variant="secondary"
              size="icon"
              icon="undo"
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              disabled={!canUndo}
              onClick={undo}
            />
            <Button
              variant="secondary"
              size="icon"
              icon="redo"
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              disabled={!canRedo}
              onClick={redo}
            />
            <Button
              variant="secondary"
              size="icon"
              icon="settings"
              aria-label={`${title} details`}
              title={`${title} details`}
              aria-haspopup="dialog"
              aria-expanded={settings}
              onClick={() => setSettings(true)}
            />
            <Button
              variant="secondary"
              size="icon"
              icon={preview ? "edit" : "eye"}
              aria-label={preview ? "Back to editor" : "Preview"}
              title={preview ? "Back to editor" : "Preview"}
              aria-pressed={preview}
              onClick={() => setPreview(!preview)}
            />
            <Button
              variant="secondary"
              size="icon"
              icon="close"
              aria-label="Cancel"
              title="Cancel"
              onClick={cancel}
              disabled={busy}
            />
            <Button
              size="icon"
              icon="save"
              aria-label={busy ? "Saving…" : saveLabel}
              title={busy ? "Saving…" : saveLabel}
              pending={busy}
              onClick={() => void save()}
            />
          </div>
        </header>
        {error && (
          <p className="pe-error" role="alert">
            {error}
          </p>
        )}
        {preview ? (
          <div className="pe-preview-area">
            <div className="pe-preview-switch">
              <Button
                variant="secondary"
                aria-pressed={mode === "customer"}
                onClick={() => setMode("customer")}
              >
                {privateProposal ? "Package preview" : "Customer page"}
              </Button>
              <Button
                variant="secondary"
                aria-pressed={mode === "card"}
                onClick={() => setMode("card")}
              >
                {privateProposal ? "Package card" : "Admin card"}
              </Button>
            </div>
            {renderPreview(displayContent, mode)}
          </div>
        ) : (
          <div className="pe-workspace">
            <aside className="pe-sidebar">
              <small>BUILD YOUR PAGE</small>
              <h2>Tell the story</h2>
              <p className="pe-clipping-note">
                Content outside a widget is clipped.
              </p>
              <small>ADD A WIDGET</small>
              {content.sections.length > 1 && (
                <label className="pe-target">
                  Add to section
                  <Select
                    value={Math.min(targetSection, content.sections.length - 1)}
                    onChange={(e) => setTargetSection(Number(e.target.value))}
                  >
                    {content.sections.map((s, i) => (
                      <option key={s.id} value={i}>
                        {s.title || `Section ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              {(["photo", "markdown", "video", "service"] as const).map((t) => (
                <Button
                  variant="secondary"
                  key={t}
                  disabled={
                    content.sections.reduce(
                      (n, s) => n + s.widgets.length,
                      0,
                    ) >= MAX_CATALOG_WIDGETS ||
                    sectionRows(
                      content.sections[
                        Math.min(targetSection, content.sections.length - 1)
                      ]?.widgets ?? [],
                    ) > MAX_CATALOG_WIDGET_Y
                  }
                  onClick={() => {
                    const sid =
                      content.sections[
                        Math.min(targetSection, content.sections.length - 1)
                      ]?.id;

                    if (sid)
                      setSection(sid, (s) => ({
                        ...s,
                        widgets: [
                          ...s.widgets,
                          widget(
                            t,
                            Math.max(0, ...s.widgets.map((w) => w.y + w.h)),
                          ),
                        ],
                      }));
                  }}
                >
                  <b>
                    {t === "photo" ? (
                      "▧"
                    ) : t === "markdown" ? (
                      "T"
                    ) : t === "video" ? (
                      "▷"
                    ) : (
                      <Icon name="box" size={18} />
                    )}
                  </b>
                  <span>
                    <strong>
                      {t === "markdown"
                        ? "Markdown"
                        : t[0].toUpperCase() + t.slice(1)}
                    </strong>
                    <small>
                      {t === "photo"
                        ? "Set the scene"
                        : t === "markdown"
                          ? "Share the details"
                          : t === "video"
                            ? "Bring it to life"
                            : `Feature a ${t}`}
                    </small>
                  </span>
                </Button>
              ))}
              <p className="pe-tip">
                <strong>Make it yours.</strong>
                <br />
                {width < 520
                  ? "Use the arrows to reorder. Open the editor on a wider screen to drag and resize widgets."
                  : "Drag widgets by their header and resize from the corner. Widgets snap to the grid."}
              </p>
            </aside>
            <div className="pe-canvas-area" ref={gridContainer}>
              <div className="pe-canvas-heading">
                <div>
                  <small>YOUR CANVAS</small>
                  <h2>{title} content</h2>
                  <p>
                    Drag and resize widgets. Content outside a widget is
                    clipped.
                  </p>
                  {width < 520 && (
                    <p>
                      Use the arrows to reorder. Drag and resize on a wider
                      screen.
                    </p>
                  )}
                </div>
                <span>▦ &nbsp; 12-column layout · widgets snap to grid</span>
              </div>
              {content.sections.map((section, index) => {
                const stacked = width < 520;
                const live =
                  activeLayout?.sectionId === section.id
                    ? activeLayout.items
                    : null;

                const rows = stacked
                  ? section.widgets.reduce((total, item) => total + item.h, 0)
                  : sectionRows(live ?? section.widgets);

                const position = (w: CatalogWidget) => {
                  const p = live?.find((item) => item.i === w.id) ?? w;

                  return `Column ${p.x + 1}, Row ${p.y + 1} · ${p.w} × ${p.h}`;
                };

                return (
                  <section key={section.id} className="pe-editor-section">
                    <div className="pe-section-bar">
                      <Input
                        variant="plain"
                        aria-label={`Section ${index + 1} title`}
                        maxLength={MAX_CATALOG_TEXT_LENGTH}
                        placeholder={`Section ${index + 1} title (optional)`}
                        value={section.title}
                        onChange={(e) =>
                          setSection(section.id, (s) => ({
                            ...s,
                            title: e.target.value,
                          }))
                        }
                      />
                      <Button
                        variant="secondary"
                        disabled={index === 0}
                        onClick={() =>
                          setContent((c) => {
                            const sections = [...c.sections];
                            [sections[index - 1], sections[index]] = [
                              sections[index],
                              sections[index - 1],
                            ];

                            return { ...c, sections };
                          })
                        }
                      >
                        ↑
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={index === content.sections.length - 1}
                        onClick={() =>
                          setContent((c) => {
                            const sections = [...c.sections];
                            [sections[index], sections[index + 1]] = [
                              sections[index + 1],
                              sections[index],
                            ];

                            return { ...c, sections };
                          })
                        }
                      >
                        ↓
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setContent((c) => ({
                            ...c,
                            sections: c.sections.filter(
                              (s) => s.id !== section.id,
                            ),
                          }))
                        }
                        disabled={content.sections.length === 1}
                      >
                        Remove section
                      </Button>
                    </div>
                    <div className="pe-grid-meta">
                      <span>
                        {stacked
                          ? `Stacked view · ${rows} rows`
                          : `${rows} ${rows === 1 ? "row" : "rows"} · 12 columns`}
                      </span>
                      {stacked && (
                        <span>
                          Saved layout: 12 columns,{" "}
                          {sectionRows(section.widgets)} rows
                        </span>
                      )}
                    </div>
                    <CatalogGridRuler stacked={stacked} />
                    <div className="pe-grid" style={catalogGridStyle}>
                      <CatalogGridGuides rows={rows} stacked={stacked} />
                      <GridLayout
                        key={gridReset[section.id] ?? 0}
                        width={Math.max(0, width)}
                        cols={CATALOG_COLUMNS}
                        maxRows={MAX_CATALOG_WIDGET_Y + MAX_CATALOG_WIDGET_ROWS}
                        compactType={null}
                        preventCollision
                        isDraggable={!busy && width >= 520}
                        isResizable={!busy && width >= 520}
                        rowHeight={CATALOG_GRID.rowHeight}
                        margin={[CATALOG_GRID.gap, CATALOG_GRID.gap]}
                        containerPadding={[
                          CATALOG_GRID.padding,
                          CATALOG_GRID.padding,
                        ]}
                        draggableHandle=".pe-widget-handle"
                        draggableCancel="button, input, textarea, select, video"
                        layout={
                          width < 520
                            ? [...section.widgets]
                                .sort((a, b) => a.y - b.y || a.x - b.x)
                                .map((w, i, sorted) => ({
                                  i: w.id,
                                  x: 0,
                                  y: sorted
                                    .slice(0, i)
                                    .reduce((total, item) => total + item.h, 0),
                                  w: CATALOG_COLUMNS,
                                  h: w.h,
                                  minW: CATALOG_COLUMNS,
                                  maxW: CATALOG_COLUMNS,
                                  minH: Math.min(4, w.h),
                                  maxH: MAX_CATALOG_WIDGET_ROWS,
                                }))
                            : section.widgets.map((w) => ({
                                i: w.id,
                                x: w.x,
                                y: w.y,
                                w: w.w,
                                h: w.h,
                                minW: Math.min(3, w.w),
                                minH: Math.min(4, w.h),
                                maxH: MAX_CATALOG_WIDGET_ROWS,
                              }))
                        }
                        onDrag={(layout) =>
                          setActiveLayout({
                            sectionId: section.id,
                            items: layout,
                          })
                        }
                        onResize={(layout) =>
                          setActiveLayout({
                            sectionId: section.id,
                            items: layout,
                          })
                        }
                        onDragStop={(layout) => commitLayout(section, layout)}
                        onResizeStop={(layout) => commitLayout(section, layout)}
                      >
                        {section.widgets.map((w) => (
                          <div
                            key={w.id}
                            className={`pe-widget ${w.type === "markdown" ? "pe-markdown-widget" : "pe-media-widget"}`}
                          >
                            <div
                              className="pe-widget-handle"
                              tabIndex={0}
                              role="group"
                              aria-label={
                                width < 520
                                  ? `${w.type} widget, saved ${position(w)}`
                                  : `${w.type}, ${position(w)}. Use arrow keys to move, Shift and arrow keys to resize.`
                              }
                              onKeyDown={(event) =>
                                keyboardLayout(section, w, event)
                              }
                            >
                              <span>
                                ⠿ &nbsp;{" "}
                                {w.type === "markdown"
                                  ? "Markdown"
                                  : w.type[0].toUpperCase() +
                                    w.type.slice(1)}{" "}
                                · {stacked ? "Saved " : ""}
                                {position(w)}
                              </span>
                              {width < 520 && (
                                <span className="pe-widget-order">
                                  <Button
                                    variant="secondary"
                                    type="button"
                                    aria-label={`Move ${w.type} up`}
                                    onClick={() =>
                                      reorderMobile(section, w.id, -1)
                                    }
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    type="button"
                                    aria-label={`Move ${w.type} down`}
                                    onClick={() =>
                                      reorderMobile(section, w.id, 1)
                                    }
                                  >
                                    ↓
                                  </Button>
                                </span>
                              )}
                              {(w.type === "photo" || w.type === "video") && (
                                <Button
                                  variant="plain"
                                  className="pe-widget-settings"
                                  type="button"
                                  aria-label={`${w.type === "photo" ? "Photo" : "Video"} settings`}
                                  aria-haspopup="dialog"
                                  onClick={() =>
                                    setMediaEditing({
                                      sectionId: section.id,
                                      widgetId: w.id,
                                    })
                                  }
                                >
                                  <Icon name="more" size={20} />
                                </Button>
                              )}
                              {entity === "package" &&
                                w.type === "service" &&
                                w.serviceId && (
                                  <Button
                                    variant="plain"
                                    className="pe-widget-settings"
                                    type="button"
                                    aria-label="Included service settings"
                                    aria-haspopup="dialog"
                                    onClick={() =>
                                      setTermsEditing({
                                        sectionId: section.id,
                                        widgetId: w.id,
                                      })
                                    }
                                  >
                                    <Icon name="more" size={20} />
                                  </Button>
                                )}
                              {w.type === "markdown" && (
                                <Button
                                  variant="plain"
                                  className="pe-markdown-toggle"
                                  type="button"
                                  aria-haspopup="dialog"
                                  onClick={() =>
                                    setMarkdownEditing({
                                      sectionId: section.id,
                                      widgetId: w.id,
                                    })
                                  }
                                >
                                  Edit Markdown
                                </Button>
                              )}
                              <Button
                                variant="plain"
                                aria-label={`Remove ${w.type}`}
                                onClick={() =>
                                  setSection(section.id, (s) => ({
                                    ...s,
                                    widgets: s.widgets.filter(
                                      (item) => item.id !== w.id,
                                    ),
                                  }))
                                }
                              >
                                ×
                              </Button>
                            </div>
                            <div className="pe-widget-body">
                              {w.type === "markdown" ? (
                                <WidgetContent widget={w} editor />
                              ) : w.type === "service" ||
                                w.type === "package" ? (
                                <Button
                                  variant="plain"
                                  type="button"
                                  className="pe-reference-widget-button"
                                  aria-label={
                                    (
                                      w.type === "package"
                                        ? w.packageId
                                        : w.serviceId
                                    )
                                      ? `Change featured ${w.type}`
                                      : `Choose a ${w.type}`
                                  }
                                  aria-haspopup="dialog"
                                  onClick={() =>
                                    setReferenceEditing({
                                      sectionId: section.id,
                                      widgetId: w.id,
                                    })
                                  }
                                >
                                  <WidgetContent
                                    widget={w}
                                    editor
                                    includedService={entity === "package"}
                                  />
                                </Button>
                              ) : (
                                <MediaWidget
                                  widget={
                                    displayContent.sections
                                      .find((s) => s.id === section.id)
                                      ?.widgets.find(
                                        (item) => item.id === w.id,
                                      ) || w
                                  }
                                  onSelectFile={(file) => {
                                    if (file) {
                                      const error = selectFile(
                                        section.id,
                                        w,
                                        file,
                                      );
                                      setError(error || "");

                                      if (error) notifyError(error);
                                    }
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </GridLayout>
                      {!section.widgets.length && (
                        <p className="pe-grid-empty">
                          Add a widget to start building this section.
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
              <Button
                variant="secondary"
                className="pe-add-section"
                disabled={content.sections.length >= MAX_CATALOG_SECTIONS}
                onClick={() => {
                  setTargetSection(content.sections.length);
                  setContent((c) => ({
                    ...c,
                    sections: [...c.sections, newSection()],
                  }));
                }}
              >
                + Add section
              </Button>
            </div>
          </div>
        )}
      </fieldset>
      {settings &&
        createPortal(
          <Dialog
            title={`${title} details`}
            className="pe-details-dialog"
            onClose={() => setSettings(false)}
            actions={<Button onClick={() => setSettings(false)}>Done</Button>}
          >
            <div ref={detailsRef}>{renderDetails(content, setContent)}</div>
          </Dialog>,
          document.body,
        )}
      {mediaEditing && editingMedia && (
        <PackageMediaSettings
          entity={entity}
          widget={editingMedia}
          fileName={files[editingMedia.id]?.name}
          onChange={(patch) =>
            changeWidget(mediaEditing.sectionId, editingMedia.id, patch)
          }
          onSelectFile={(file) =>
            selectFile(mediaEditing.sectionId, editingMedia, file)
          }
          onClose={() => setMediaEditing(null)}
        />
      )}
      {referenceEditing &&
        editingReference &&
        (editingReference.type === "service" ||
          editingReference.type === "package") && (
          <CatalogReferencePickerDialog
            key={editingReference.id}
            kind={editingReference.type}
            selectedId={
              editingReference.type === "package"
                ? editingReference.packageId
                : editingReference.serviceId
            }
            caption={editingReference.caption}
            onCaptionChange={(caption) =>
              changeWidget(referenceEditing.sectionId, editingReference.id, {
                caption,
              })
            }
            onSelect={(item) => {
              if (
                entity === "package" &&
                editingReference.type === "service" &&
                content.addonServices?.some(
                  (addon) =>
                    addon.serviceId.toLowerCase() === item.id.toLowerCase(),
                )
              ) {
                setError(
                  notifyError(
                    "This service is already an add-on. Remove it from add-ons before including it.",
                  ),
                );
                setReferenceEditing(null);

                return;
              }

              const { pricing, ...reference } = item;
              changeWidget(referenceEditing.sectionId, editingReference.id, {
                ...(editingReference.type === "package"
                  ? { packageId: item.id, package: reference }
                  : {
                      serviceId: item.id,
                      service: reference,
                      ...(entity === "package" &&
                      item.id !== editingReference.serviceId &&
                      pricing
                        ? {
                            serviceTerms: {
                              includedHours: pricing.includedHours,
                              hourlyRatePesos: pricing.hourlyRatePesos,
                            },
                          }
                        : {}),
                    }),
              });
              setReferenceEditing(null);
            }}
            onClose={() => setReferenceEditing(null)}
          />
        )}
      {termsEditing && editingTerms?.serviceId && (
        <ServiceTermsDialog
          serviceId={editingTerms.serviceId}
          terms={
            editingTerms.serviceTerms ?? {
              includedHours: null,
              hourlyRatePesos: null,
            }
          }
          onSave={(value) => {
            changeWidget(termsEditing.sectionId, editingTerms.id, {
              serviceTerms: {
                includedHours: value.includedHours,
                hourlyRatePesos: value.hourlyRatePesos,
              },
            });
            setTermsEditing(null);
          }}
          onClose={() => setTermsEditing(null)}
        />
      )}
      {markdownEditing && editingMarkdown && (
        <MarkdownSettings
          widget={editingMarkdown}
          onChange={(markdown) =>
            changeWidget(markdownEditing.sectionId, markdownEditing.widgetId, {
              markdown,
            })
          }
          onClose={() => setMarkdownEditing(null)}
        />
      )}
    </NativeDialog>,
    document.body,
  );
}
