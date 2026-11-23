import { lockCatalogScroll } from "./catalog-scroll-lock";
import {
  Button,
  Dialog,
  Icon,
  Input,
  NativeDialog,
  Select,
  Textarea,
  useNotifications,
  CatalogGridGuides,
  CatalogGridRuler,
  CATALOG_GRID,
  catalogGridMetrics,
  catalogGridStyle,
} from "@event-management/ui";
import {
  CATALOG_COLUMNS,
  LEGACY_CATALOG_COLUMNS,
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
import { calcGridItemPosition, calcXY, collides } from "react-grid-layout/core";
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
import { CatalogWidgetPalette } from "./CatalogWidgetPalette";
import type { PalettePoint, PaletteWidget } from "./CatalogWidgetPalette";
import "react-grid-layout/css/styles.css";
import "../../styles/catalog/package-editor.css";

const uuid = () => crypto.randomUUID();

export const newCatalogSection = (): CatalogSection => ({
  id: uuid(),
  title: "",
  columns: CATALOG_COLUMNS,
  widgets: [],
});

const newSection = newCatalogSection;

const NEW_WIDGET_WIDTH = CATALOG_COLUMNS / 2;
const NEW_WIDGET_HEIGHT = 5;
const MIN_WIDGET_WIDTH = CATALOG_COLUMNS / 4;
const MAX_GRID_ROWS = MAX_CATALOG_WIDGET_Y + MAX_CATALOG_WIDGET_ROWS;

const widget = (type: PaletteWidget, x: number, y: number): CatalogWidget => ({
  id: uuid(),
  type,
  x,
  y,
  w: NEW_WIDGET_WIDTH,
  h: NEW_WIDGET_HEIGHT,
  markdown:
    type === "markdown" ? "## Your heading\n\nTell your story here." : "",
  media: null,
  alt: "",
  caption: "",
  autoplay: false,
});

const sectionRows = (widgets: readonly { y: number; h: number }[]) =>
  Math.max(0, ...widgets.map((w) => w.y + w.h));

function editorSection(section: CatalogSection): CatalogSection {
  if (section.columns === CATALOG_COLUMNS) return section;

  const scale = CATALOG_COLUMNS / LEGACY_CATALOG_COLUMNS;

  return {
    ...section,
    columns: CATALOG_COLUMNS,
    widgets: section.widgets.map((item) => ({
      ...item,
      x: item.x * scale,
      w: item.w * scale,
    })),
  };
}

type DropTarget = {
  sectionId: string;
  x: number;
  y: number;
  valid: boolean;
  box: ReturnType<typeof calcGridItemPosition>;
};

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

function InlineMarkdownWidget({
  widget,
  editing,
  onChange,
  onEdit,
  onBlur,
}: {
  widget: CatalogWidget;
  editing: boolean;
  onChange: (markdown: string) => void;
  onEdit: () => void;
  onBlur: () => void;
}) {
  const source = useRef<HTMLTextAreaElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useLayoutEffect(() => {
    if (editing) {
      source.current?.focus({ preventScroll: true });
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
  }, [editing]);

  return editing ? (
    <Textarea
      ref={source}
      variant="plain"
      className="pe-markdown-source"
      aria-label="Markdown content"
      spellCheck={false}
      maxLength={MAX_WIDGET_MARKDOWN_LENGTH}
      value={widget.markdown}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;

        event.preventDefault();
        restoreFocus.current = true;
        onBlur();
      }}
    />
  ) : (
    <div className="pe-markdown-widget">
      <div className="pe-markdown-rendered" inert>
        <WidgetContent widget={widget} editor />
      </div>
      <Button
        ref={trigger}
        variant="plain"
        className="pe-markdown-edit-trigger"
        aria-label="Edit Markdown widget"
        title="Edit Markdown"
        onClick={onEdit}
      >
        {widget.markdown.trim() ? null : "Add Markdown"}
      </Button>
    </div>
  );
}

type CanvasContent = {
  name: string;
  eventType?: string | null;
  sections: CatalogSection[];
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
  nameBadge,
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
  /** Optional small badge shown beside the name in the editor header. */
  nameBadge?: (content: T) => ReactNode;
  privateProposal?: boolean;
}) {
  const { notify, notifyError } = useNotifications();
  const title = privateProposal
    ? "Private package"
    : entity[0].toUpperCase() + entity.slice(1);

  const [content, setContentState] = useState<T>(() => {
    const draft = structuredClone(initial);

    return { ...draft, sections: draft.sections.map(editorSection) };
  });

  const contentRef = useRef(content);
  const historyRef = useRef<{ past: T[]; future: T[] }>({
    past: [],
    future: [],
  });
  const lastEdit = useRef<{ at: number; field: Element | null }>({
    at: 0,
    field: null,
  });

  const shortcuts = useRef({ undo: () => {}, redo: () => {}, busy: false });

  const [canUndo, setCanUndo] = useState(false),
    [canRedo, setCanRedo] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [markdownEditing, setMarkdownEditing] = useState<string | null>(null);
  const [referenceEditing, setReferenceEditing] = useState<{
    sectionId: string;
    widgetId: string;
  } | null>(null);
  const [termsEditing, setTermsEditing] = useState<{
    sectionId: string;
    widgetId: string;
  } | null>(null);
  const [targetSection, setTargetSection] = useState(initial.sections[0]?.id);
  const [paletteTarget, setPaletteTarget] = useState<DropTarget | null>(null);
  const [reordering, setReordering] = useState<{
    sectionId: string;
    widgetId: string;
  } | null>(null);
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

    const activeElement = document.activeElement;
    const field = isTextField(activeElement) ? activeElement : null;
    const now = Date.now();

    // One burst of typing in a field becomes a single undo step.
    if (!(
      field &&
      lastEdit.current.field === field &&
      now - lastEdit.current.at < TEXT_BURST_MS
    )) {
      historyRef.current.past = [...historyRef.current.past, previous].slice(
        -HISTORY_LIMIT,
      );
      historyRef.current.future = [];
    }

    lastEdit.current = { at: now, field };
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
    lastEdit.current = { at: 0, field: null };
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
    lastEdit.current = { at: 0, field: null };
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

  const reorderingSection = content.sections.find(
    (section) => section.id === reordering?.sectionId,
  );

  const reorderIndex = reorderingSection
    ? [...reorderingSection.widgets]
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .findIndex((item) => item.id === reordering?.widgetId)
    : -1;

  const pending = useRef<string[]>([]),
    objectUrls = useRef<string[]>([]);
  const [{ width, stacked }, setCanvasSize] = useState({
    width: 800,
    stacked: false,
  });
  const gridContainer = useRef<HTMLDivElement>(null);
  const { rowHeight, gap, padding } = catalogGridMetrics(width, stacked);
  const gridMetrics = {
    containerWidth: width,
    margin: [gap, gap] as const,
    containerPadding: [padding, padding] as const,
    rowHeight,
    cols: CATALOG_COLUMNS,
    maxRows: MAX_GRID_ROWS,
  };
  useLayoutEffect(() => {
    const node = gridContainer.current;

    if (!node) return;

    const measure = (canvasWidth: number) => {
      // Use the same available width to choose a mode as the preview without its rail.
      const viewportWidth =
        (node.parentElement?.clientWidth ?? node.offsetWidth) -
        (node.offsetWidth - node.clientWidth);
      setCanvasSize({
        width: canvasWidth,
        stacked: viewportWidth < CATALOG_GRID.stackedBelow,
      });
    };

    measure(node.clientWidth);

    const observer = new ResizeObserver((entries) =>
      measure(entries[0].contentRect.width),
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

  const addSectionTarget =
    content.sections.find((section) => section.id === targetSection) ??
    content.sections[0];

  const paletteDisabled =
    busy ||
    content.sections.reduce(
      (count, section) => count + section.widgets.length,
      0,
    ) >= MAX_CATALOG_WIDGETS;

  const addWidget = (
    sectionId: string,
    type: PaletteWidget,
    x: number,
    y: number,
  ) => {
    if (paletteDisabled) return;

    if (y > MAX_CATALOG_WIDGET_Y) {
      notify("This section has reached the last available row.", "danger");

      return;
    }

    setSection(sectionId, (section) => ({
      ...section,
      widgets: [...section.widgets, widget(type, x, y)],
    }));
    setTargetSection(sectionId);
  };

  const findDropTarget = ({ x, y }: PalettePoint): DropTarget | null => {
    const grid = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-catalog-drop-section]");

    const section = contentRef.current.sections.find(
      (item) => item.id === grid?.dataset.catalogDropSection,
    );

    if (!grid || !section) return null;

    const rect = grid.getBoundingClientRect();
    const append = section.widgets.length > 0 && y >= rect.bottom - padding;
    const snapped = calcXY(
      gridMetrics,
      y - rect.top,
      x - rect.left,
      NEW_WIDGET_WIDTH,
      NEW_WIDGET_HEIGHT,
    );
    const placement = stacked
      ? { x: 0, y: sectionRows(section.widgets) }
      : { ...snapped, y: append ? sectionRows(section.widgets) : snapped.y };
    const candidate = {
      i: "",
      ...placement,
      w: NEW_WIDGET_WIDTH,
      h: NEW_WIDGET_HEIGHT,
    };

    const valid =
      placement.y <= MAX_CATALOG_WIDGET_Y &&
      !section.widgets.some((item) =>
        collides(candidate, { ...item, i: item.id }),
      );

    const box = calcGridItemPosition(
      gridMetrics,
      placement.x,
      stacked
        ? section.widgets.reduce((rows, item) => rows + item.h, 0)
        : placement.y,
      stacked ? CATALOG_COLUMNS : NEW_WIDGET_WIDTH,
      NEW_WIDGET_HEIGHT,
    );

    return { sectionId: section.id, ...placement, valid, box };
  };

  const changeWidget = (
    sid: string,
    id: string,
    patch: Partial<CatalogWidget>,
  ) =>
    setSection(sid, (s) => ({
      ...s,
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));

  const widgetSettingsLabel = (item: CatalogWidget) =>
    item.type === "markdown"
      ? "Edit Markdown"
      : item.type === "service" && entity === "package" && item.serviceId
        ? "Included service settings"
        : `${item.type[0].toUpperCase()}${item.type.slice(1)} settings`;

  const openWidgetSettings = (sectionId: string, item: CatalogWidget) => {
    const selection = { sectionId, widgetId: item.id };

    switch (item.type) {
      case "markdown":
        setMarkdownEditing(item.id);
        break;
      case "service":
        if (entity === "package" && item.serviceId) {
          setTermsEditing(selection);
          break;
        }

        setReferenceEditing(selection);
        break;
      case "package":
        setReferenceEditing(selection);
        break;
      default:
        setMediaEditing(selection);
    }
  };

  const keyboardLayout = (
    section: CatalogSection,
    current: CatalogWidget,
    event: React.KeyboardEvent,
  ) => {
    if (event.target !== event.currentTarget) return;

    if (
      busy ||
      stacked ||
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
      next.w < Math.min(MIN_WIDGET_WIDTH, current.w) ||
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
            {nameBadge && (
              <span className="pe-name-badge">{nameBadge(content)}</span>
            )}
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
              onClick={() => {
                setMarkdownEditing(null);
                setPreview(!preview);
              }}
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
            <CatalogWidgetPalette
              disabled={paletteDisabled}
              onAdd={(type) => {
                if (addSectionTarget)
                  addWidget(
                    addSectionTarget.id,
                    type,
                    0,
                    sectionRows(addSectionTarget.widgets),
                  );
              }}
              onDrag={(point) =>
                setPaletteTarget(point ? findDropTarget(point) : null)
              }
              onDrop={(type, point) => {
                const target = findDropTarget(point);

                if (target?.valid)
                  addWidget(target.sectionId, type, target.x, target.y);
              }}
            />
            <div
              className="pe-canvas-area"
              ref={gridContainer}
              data-stacked={stacked || undefined}
            >
              <div className="pe-canvas-heading">
                <h2>{title} content</h2>
                {content.sections.length > 1 && (
                  <label className="pe-target">
                    Add to section
                    <Select
                      value={addSectionTarget?.id ?? ""}
                      onChange={(event) => setTargetSection(event.target.value)}
                    >
                      {content.sections.map((section, index) => (
                        <option key={section.id} value={section.id}>
                          {section.title || `Section ${index + 1}`}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}
              </div>
              {content.sections.map((section, index) => {
                const live =
                  activeLayout?.sectionId === section.id
                    ? activeLayout.items
                    : null;

                const rows = stacked
                  ? section.widgets.reduce((total, item) => total + item.h, 0)
                  : sectionRows(live ?? section.widgets);

                const drop =
                  paletteTarget?.sectionId === section.id
                    ? paletteTarget
                    : null;

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
                        size="icon"
                        icon="arrow"
                        className="pe-section-up"
                        aria-label="Move section up"
                        title="Move section up"
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
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        icon="arrow"
                        className="pe-section-down"
                        aria-label="Move section down"
                        title="Move section down"
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
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        icon="trash"
                        aria-label="Remove section"
                        title="Remove section"
                        onClick={() =>
                          setContent((c) => ({
                            ...c,
                            sections: c.sections.filter(
                              (s) => s.id !== section.id,
                            ),
                          }))
                        }
                        disabled={content.sections.length === 1}
                      />
                    </div>
                    <CatalogGridRuler stacked={stacked} />
                    <div
                      className="pe-grid"
                      style={catalogGridStyle}
                      data-catalog-drop-section={section.id}
                      data-empty={!section.widgets.length || undefined}
                      data-drop-active={!!drop || undefined}
                    >
                      <CatalogGridGuides rows={rows} stacked={stacked} />
                      <GridLayout
                        key={`${stacked}-${gridReset[section.id] ?? 0}`}
                        width={Math.max(0, width)}
                        cols={CATALOG_COLUMNS}
                        maxRows={MAX_GRID_ROWS}
                        compactType={null}
                        preventCollision
                        isDraggable={!busy && !stacked}
                        isResizable={!busy && !stacked}
                        rowHeight={rowHeight}
                        margin={[gap, gap]}
                        containerPadding={[padding, padding]}
                        draggableHandle=".pe-widget-move, .pe-widget-drag-surface"
                        draggableCancel="button, input, textarea, select, video, a"
                        layout={
                          stacked
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
                                minW: Math.min(MIN_WIDGET_WIDTH, w.w),
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
                            className="pe-widget"
                            data-tools-end={
                              (!stacked &&
                                w.x + w.w / 2 > CATALOG_COLUMNS / 2) ||
                              undefined
                            }
                          >
                            <div className="pe-widget-tools">
                              {stacked ? (
                                <Button
                                  variant="plain"
                                  icon="grip"
                                  className="pe-widget-control"
                                  aria-label={`Reorder ${w.type} widget`}
                                  title="Reorder widget"
                                  aria-haspopup="dialog"
                                  disabled={section.widgets.length < 2}
                                  onClick={() =>
                                    setReordering({
                                      sectionId: section.id,
                                      widgetId: w.id,
                                    })
                                  }
                                />
                              ) : (
                                <div
                                  className="pe-widget-control pe-widget-move"
                                  tabIndex={0}
                                  role="group"
                                  title="Drag to move"
                                  aria-label={`Move ${w.type} widget. Use arrow keys to move, Shift and arrow keys to resize.`}
                                  onKeyDown={(event) =>
                                    keyboardLayout(section, w, event)
                                  }
                                >
                                  <Icon name="grip" size={17} />
                                </div>
                              )}
                              <Button
                                variant="plain"
                                icon="more"
                                className="pe-widget-control"
                                aria-label={widgetSettingsLabel(w)}
                                title={widgetSettingsLabel(w)}
                                aria-haspopup={
                                  w.type === "markdown" ? undefined : "dialog"
                                }
                                onClick={() =>
                                  openWidgetSettings(section.id, w)
                                }
                              />
                              <Button
                                variant="plain"
                                icon="close"
                                className="pe-widget-control pe-widget-remove"
                                aria-label={`Remove ${w.type}`}
                                title={`Remove ${w.type}`}
                                onClick={() =>
                                  setSection(section.id, (s) => ({
                                    ...s,
                                    widgets: s.widgets.filter(
                                      (item) => item.id !== w.id,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div
                              className={`ui-catalog-widget pe-widget-body${!stacked && w.type === "photo" ? " pe-widget-drag-surface" : ""}`}
                            >
                              {w.type === "markdown" ? (
                                <InlineMarkdownWidget
                                  widget={w}
                                  editing={markdownEditing === w.id}
                                  onEdit={() => setMarkdownEditing(w.id)}
                                  onBlur={() =>
                                    setMarkdownEditing((current) =>
                                      current === w.id ? null : current,
                                    )
                                  }
                                  onChange={(markdown) =>
                                    changeWidget(section.id, w.id, { markdown })
                                  }
                                />
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
                          Drag a widget here or select one from the sidebar.
                        </p>
                      )}
                      {drop && (
                        <div
                          className="pe-drop-preview"
                          style={drop.box}
                          data-valid={drop.valid}
                          aria-hidden="true"
                        >
                          {!drop.valid && "Drop in an open area"}
                        </div>
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
                  const section = newSection();
                  setTargetSection(section.id);
                  setContent((c) => ({
                    ...c,
                    sections: [...c.sections, section],
                  }));
                }}
              >
                + Add section
              </Button>
            </div>
          </div>
        )}
      </fieldset>
      {reordering &&
        reorderingSection &&
        reorderIndex !== -1 &&
        createPortal(
          <Dialog
            title="Reorder widget"
            onClose={() => setReordering(null)}
            actions={<Button onClick={() => setReordering(null)}>Done</Button>}
          >
            <div className="pe-reorder-actions">
              <Button
                variant="secondary"
                disabled={reorderIndex === 0}
                onClick={() =>
                  reorderMobile(reorderingSection, reordering.widgetId, -1)
                }
              >
                Move up
              </Button>
              <Button
                variant="secondary"
                disabled={reorderIndex >= reorderingSection.widgets.length - 1}
                onClick={() =>
                  reorderMobile(reorderingSection, reordering.widgetId, 1)
                }
              >
                Move down
              </Button>
            </div>
          </Dialog>,
          document.body,
        )}
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
    </NativeDialog>,
    document.body,
  );
}
