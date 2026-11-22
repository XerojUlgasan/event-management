import {
  isMeaningfulLine,
  linesFromItems,
  lineText,
  median,
  readingOrder,
  type Line,
  type PositionedText,
} from "./page-reading-order.js";

export type { PositionedText } from "./page-reading-order.js";

export type SectionWord = {
  text: string;
  page: number;
};

export type DocumentSection = {
  headingPath: string[];
  words: SectionWord[];
};

type Block = {
  role: "heading" | "body";
  level: number;
  fontSize: number;
  text: string;
  words: SectionWord[];
};

const HEADING_FONT_RATIO = 1.15;

export function pageHasMeaningfulText(items: PositionedText[]): boolean {
  return linesFromItems(items.map((item) => ({ ...item, page: 1 })))
    .map(lineText)
    .some((text) => isMeaningfulLine(text));
}

export function layoutDocument(pages: PositionedText[][]): DocumentSection[] {
  const lines = pages.flatMap((items, index) =>
    readingOrder(
      linesFromItems(
        items.map((item) => ({
          ...item,
          page: index + 1,
        })),
      ),
    ),
  );

  const bodySize = bodyFontSize(lines);
  const headingSizes = headingFontSizes(lines, bodySize);
  const blocks = joinAcrossPages(linesToBlocks(lines, bodySize, headingSizes));

  return sectionsFromBlocks(blocks);
}

function linesToBlocks(
  lines: Line[],
  bodySize: number,
  headingSizes: number[],
): Block[] {
  const blocks: Block[] = [];

  for (const line of lines) {
    const text = lineText(line).trim();

    if (!isMeaningfulLine(text)) continue;

    if (isHeading(line, text, bodySize)) {
      blocks.push({
        role: "heading",
        level: headingLevel(line.fontSize, headingSizes),
        fontSize: line.fontSize,
        text,
        words: [],
      });
      continue;
    }

    const words = text
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => ({
        text: word,
        page: line.page,
      }));

    const previous = blocks[blocks.length - 1];
    const canAppend =
      previous?.role === "body" &&
      previous.words[0]?.page === line.page &&
      Math.abs(previous.fontSize - line.fontSize) <= 1;

    if (previous && canAppend) {
      previous.words.push(...words);
      previous.text = `${previous.text} ${text}`;
      continue;
    }

    blocks.push({
      role: "body",
      level: 0,
      fontSize: line.fontSize,
      text,
      words,
    });
  }

  return blocks;
}

function joinAcrossPages(blocks: Block[]): Block[] {
  const joined: Block[] = [];

  for (const block of blocks) {
    const previous = joined[joined.length - 1];

    if (previous && continues(previous, block)) {
      previous.words = mergeWords(previous.words, block.words);
      previous.text = wordsToText(previous.words);
      continue;
    }

    joined.push({
      ...block,
      words: [...block.words],
    });
  }

  return joined;
}

function continues(previous: Block, next: Block): boolean {
  if (previous.role !== "body" || next.role !== "body") return false;

  const previousPage = previous.words[previous.words.length - 1]?.page ?? 0;
  const nextPage = next.words[0]?.page ?? 0;

  if (nextPage <= previousPage) return false;

  if (Math.abs(previous.fontSize - next.fontSize) > 1) return false;

  const previousText = wordsToText(previous.words);
  const nextText = wordsToText(next.words);

  if (!previousText || !nextText) return false;

  if (/[.!?]["')\]]*$/.test(previousText)) return false;

  return true;
}

function mergeWords(left: SectionWord[], right: SectionWord[]): SectionWord[] {
  const merged = left.map((word) => ({ ...word }));

  const nextWords = right.map((word) => ({ ...word }));

  const last = merged[merged.length - 1];
  const first = nextWords[0];

  if (
    last &&
    first &&
    last.text.endsWith("-") &&
    /^[\p{Ll}\p{N}]/u.test(first.text)
  ) {
    last.text = `${last.text.slice(0, -1)}${first.text}`;
    merged.push(...nextWords.slice(1));

    return merged;
  }

  merged.push(...nextWords);

  return merged;
}

function sectionsFromBlocks(blocks: Block[]): DocumentSection[] {
  const stack: { level: number; text: string }[] = [];
  const sections: DocumentSection[] = [];
  let current: DocumentSection | null = null;

  for (const block of blocks) {
    if (block.role === "heading") {
      while (
        stack.length > 0 &&
        (stack[stack.length - 1]?.level ?? 0) >= block.level
      )
        stack.pop();

      stack.push({ level: block.level, text: block.text });
      current = null;
      continue;
    }

    const headingPath = stack.map((heading) => heading.text);

    if (!current || !samePath(current.headingPath, headingPath)) {
      current = { headingPath, words: [] };
      sections.push(current);
    }

    current.words.push(...block.words);
  }

  return sections.filter((section) => section.words.length > 0);
}

function headingFontSizes(lines: Line[], bodySize: number): number[] {
  const sizes = new Set<number>();

  for (const line of lines) {
    const text = lineText(line).trim();

    if (!isHeading(line, text, bodySize)) continue;

    sizes.add(Math.round(line.fontSize * 2) / 2);
  }

  return [...sizes].sort((left, right) => right - left);
}

function isHeading(line: Line, text: string, bodySize: number): boolean {
  if (!isMeaningfulLine(text)) return false;

  const words = text.split(/\s+/);

  if (words.length > 16 || text.length > 100) return false;

  if (/[.!?,:;]$/.test(text)) return false;

  const bold = line.items.some((item) => /bold/i.test(item.fontFamily));

  return (
    line.fontSize >= bodySize * HEADING_FONT_RATIO ||
    (bold && line.fontSize + 0.5 >= bodySize)
  );
}

function headingLevel(fontSize: number, sizes: number[]): number {
  const rounded = Math.round(fontSize * 2) / 2;

  const index = sizes.findIndex((size) => Math.abs(size - rounded) < 0.4);

  return index === -1 ? sizes.length + 1 : index + 1;
}

function bodyFontSize(lines: Line[]): number {
  const sizes: number[] = [];

  for (const line of lines) {
    const text = lineText(line).trim();

    if (!isMeaningfulLine(text)) continue;

    const weight = Math.min(text.length, 200);

    for (let index = 0; index < weight; index += 1) sizes.push(line.fontSize);
  }

  return sizes.length === 0 ? 12 : median(sizes);
}

function wordsToText(words: SectionWord[]): string {
  return words.map((word) => word.text).join(" ");
}

function samePath(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => entry === right[index])
  );
}
