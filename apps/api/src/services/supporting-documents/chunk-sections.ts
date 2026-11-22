import {
  estimateTokens,
  SUPPORTING_DOCUMENT_MAX_OVERLAP_TOKENS,
  SUPPORTING_DOCUMENT_MAX_TOKENS,
  SUPPORTING_DOCUMENT_TARGET_TOKENS,
} from "./document-limits.js";
import type { DocumentSection, SectionWord } from "./layout-blocks.js";

export type PreparedChunk = {
  ordinal: number;
  pageStart: number;
  pageEnd: number;
  headingPath: string[];
  contentText: string;
};

export function chunkSections(sections: DocumentSection[]): PreparedChunk[] {
  const chunks = sections.flatMap((section) => chunkSection(section));

  return chunks.map((chunk, index) => ({
    ...chunk,
    ordinal: index + 1,
  }));
}

function chunkSection(section: DocumentSection): PreparedChunk[] {
  const words = section.words;
  const chunks: PreparedChunk[] = [];
  let start = 0;

  while (start < words.length) {
    const end = takeChunkEnd(section.headingPath, words, start);
    const slice = words.slice(start, end);

    if (slice.length === 0) break;

    chunks.push(toChunk(section.headingPath, slice));

    if (end >= words.length) break;

    const overlapAt = overlapIndex(words, start, end);
    const next = overlapAt < end ? overlapAt : end;

    if (next <= start) break;

    start = next;
  }

  return chunks;
}

function takeChunkEnd(
  path: string[],
  words: SectionWord[],
  start: number,
): number {
  const first = words[start];

  if (!first) return start;

  if (
    estimateTokens(contentText(path, [first])) > SUPPORTING_DOCUMENT_MAX_TOKENS
  ) {
    const pieces = splitOversized(path, first);
    words.splice(start, 1, ...pieces);

    return start + 1;
  }

  let end = start;

  while (
    end < words.length &&
    tokensFor(path, words.slice(start, end + 1)) <=
      SUPPORTING_DOCUMENT_TARGET_TOKENS
  )
    end += 1;

  if (end === start) end = start + 1;

  if (endsSentence(words[end - 1]?.text ?? "")) return end;

  while (
    end < words.length &&
    tokensFor(path, words.slice(start, end + 1)) <=
      SUPPORTING_DOCUMENT_MAX_TOKENS
  ) {
    end += 1;

    if (endsSentence(words[end - 1]?.text ?? "")) break;
  }

  return end;
}

function overlapIndex(
  words: SectionWord[],
  chunkStart: number,
  chunkEnd: number,
): number {
  let index = chunkEnd;
  let chosen = chunkEnd;
  let sentenceStart = chunkEnd;
  const endsAtSentence = endsSentence(words[chunkEnd - 1]?.text ?? "");

  while (index > chunkStart + 1) {
    const candidate = words.slice(index - 1, chunkEnd);

    const text = candidate.map((word) => word.text).join(" ");

    if (estimateTokens(text) > SUPPORTING_DOCUMENT_MAX_OVERLAP_TOKENS) break;

    if (!/[\p{L}\p{N}]/u.test(text)) break;

    index -= 1;
    chosen = index;

    if (endsAtSentence && endsSentence(words[index - 1]?.text ?? ""))
      sentenceStart = index;
  }

  return sentenceStart < chunkEnd ? sentenceStart : chosen;
}

function splitOversized(path: string[], word: SectionWord): SectionWord[] {
  const pieces: SectionWord[] = [];
  let rest = word.text;

  while (rest.length > 0) {
    let size = longestFittingPrefix(path, rest);

    if (
      estimateTokens(
        contentText(path, [{ ...word, text: rest.slice(0, size) }]),
      ) > SUPPORTING_DOCUMENT_MAX_TOKENS
    )
      size = 1;

    pieces.push({ text: rest.slice(0, size), page: word.page });
    rest = rest.slice(size);
  }

  return pieces;
}

function longestFittingPrefix(path: string[], word: string): number {
  let low = 1;
  let high = word.length;
  let best = 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (
      estimateTokens(
        contentText(path, [{ text: word.slice(0, mid), page: 1 }]),
      ) <= SUPPORTING_DOCUMENT_MAX_TOKENS
    ) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function toChunk(path: string[], words: SectionWord[]): PreparedChunk {
  const pages = words.map((word) => word.page);

  return {
    ordinal: 0,
    pageStart: Math.min(...pages),
    pageEnd: Math.max(...pages),
    headingPath: [...path],
    contentText: contentText(path, words),
  };
}

function tokensFor(path: string[], words: SectionWord[]): number {
  return estimateTokens(contentText(path, words));
}

export function contentText(path: string[], words: SectionWord[]): string {
  const body = words.map((word) => word.text).join(" ");

  const prefix = fittedPrefix(path, body);

  if (!prefix) return body;

  if (!body) return prefix;

  return `${prefix}\n\n${body}`;
}

function fittedPrefix(path: string[], body: string): string {
  const parts = [...path];

  while (
    parts.length > 1 &&
    estimateTokens(`${parts.join(" > ")}\n\n${body || "x"}`) >
      SUPPORTING_DOCUMENT_MAX_TOKENS
  )
    parts.shift();

  return parts.join(" > ");
}

function endsSentence(word: string): boolean {
  return /[.!?]["')\]]*$/.test(word);
}
