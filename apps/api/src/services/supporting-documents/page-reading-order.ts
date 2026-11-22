export type PositionedText = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  dir: "ltr" | "rtl" | "ttb";
  hasEOL: boolean;
};

type PageItem = PositionedText & { page: number };

export type Line = {
  y: number;
  fontSize: number;
  page: number;
  items: PageItem[];
};

const COLUMN_GAP = 36;
const COLUMN_ALIGNMENT = 24;

export function linesFromItems(items: PageItem[]): Line[] {
  const visible = items.filter(
    (item) => item.str.trim().length > 0 && item.fontSize > 0,
  );

  const ordered = [...visible].sort(
    (left, right) => right.y - left.y || left.x - right.x,
  );

  const lines: Line[] = [];

  for (const item of ordered) {
    const current = lines[lines.length - 1];
    const tolerance = Math.max(current?.fontSize ?? 0, item.fontSize, 1) * 0.4;

    const sameLine =
      current &&
      !current.items.some((entry) => entry.hasEOL) &&
      Math.abs(current.y - item.y) <= tolerance;

    if (!current || !sameLine) {
      lines.push({
        y: item.y,
        fontSize: item.fontSize,
        page: item.page,
        items: [item],
      });
      continue;
    }

    current.items.push(item);
    current.fontSize = Math.max(current.fontSize, item.fontSize);
  }

  return lines.sort(
    (left, right) => left.page - right.page || right.y - left.y,
  );
}

export function readingOrder(lines: Line[]): Line[] {
  const splitXs = lines
    .map(widestGap)
    .filter(
      (gap): gap is { splitX: number; gap: number; index: number } =>
        gap !== null,
    )
    .map((gap) => gap.splitX);

  if (splitXs.length < 3) return lines;

  const splitX = median(splitXs);

  const aligned = lines.filter((line) => {
    const gap = widestGap(line);

    return gap !== null && Math.abs(gap.splitX - splitX) <= COLUMN_ALIGNMENT;
  });

  if (aligned.length < 3) return lines;

  const left: Line[] = [];
  const right: Line[] = [];
  const ordered: Line[] = [];

  const flushColumns = () => {
    ordered.push(...left, ...right);
    left.length = 0;
    right.length = 0;
  };

  for (const line of lines) {
    const gap = widestGap(line);

    if (!gap || Math.abs(gap.splitX - splitX) > COLUMN_ALIGNMENT) {
      flushColumns();
      ordered.push(line);
      continue;
    }

    const items = [...line.items].sort((a, b) => a.x - b.x);

    left.push({ ...line, items: items.slice(0, gap.index) });
    right.push({ ...line, items: items.slice(gap.index) });
  }

  flushColumns();

  return ordered;
}

function widestGap(
  line: Line,
): { splitX: number; gap: number; index: number } | null {
  const items = [...line.items].sort((left, right) => left.x - right.x);

  let best: { splitX: number; gap: number; index: number } | null = null;

  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];

    if (!previous || !current) continue;

    const gap = current.x - (previous.x + Math.max(previous.width, 0));

    if (gap < COLUMN_GAP || (best && gap <= best.gap)) continue;

    best = { splitX: current.x, gap, index };
  }

  return best;
}

export function lineText(line: Line): string {
  const items = [...line.items].sort((left, right) =>
    line.items.some((item) => item.dir === "rtl")
      ? right.x - left.x
      : left.x - right.x,
  );

  let text = "";
  let cursor = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    const gap = item.x - cursor;

    if (
      text.length > 0 &&
      (gap > Math.max(item.fontSize, 1) * 0.2 || item.str.startsWith(" "))
    )
      text += " ";

    text += item.str;
    cursor =
      item.x + Math.max(item.width, item.str.length * item.fontSize * 0.4);
  }

  return text.replace(/[ \t]+/g, " ").trim();
}

export function isMeaningfulLine(text: string): boolean {
  const trimmed = text.trim();

  if (!/[\p{L}\p{N}]/u.test(trimmed)) return false;

  return !isPageNumberLine(trimmed);
}

function isPageNumberLine(text: string): boolean {
  return /^(?:page\s+)?(?:\d{1,4}|[ivxlcdm]{1,8})(?:\s*(?:\/|of)\s*\d{1,4})?$/i.test(
    text.trim(),
  );
}

export function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);

  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];

  if (upper === undefined) return 0;

  if (sorted.length % 2 === 0 && lower !== undefined)
    return (lower + upper) / 2;

  return upper;
}
