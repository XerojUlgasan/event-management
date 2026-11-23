/**
 * Deterministic token estimate for supporting-document chunks.
 * Four ASCII characters are about one token. Reserve more space for
 * non-ASCII text. This is a local estimate rather than a model tokenizer.
 */
export function estimateTokens(text: string): number {
  let units = 0;

  for (const character of text) {
    const codePoint = character.codePointAt(0)!;
    units += codePoint < 128 ? 1 : codePoint <= 0xffff ? 8 : 16;
  }

  return Math.ceil(units / 4);
}

/** Preferred chunk size, including the heading-path prefix. */
export const SUPPORTING_DOCUMENT_TARGET_TOKENS = 512;

/**
 * Hard cap for one chunk, including the heading-path prefix.
 * A chunk may pass the target to finish its current sentence, then stops.
 */
export const SUPPORTING_DOCUMENT_MAX_TOKENS = 1024;

/**
 * Maximum meaningful overlap copied into the next chunk.
 * Overlap stays inside the same heading path and counts toward the hard cap.
 */
export const SUPPORTING_DOCUMENT_MAX_OVERLAP_TOKENS = 64;

/**
 * Pages prepared in one call. Above this, preparation fails closed.
 * The cap is above the 100-page documents this flow must accept.
 */
export { SUPPORTING_DOCUMENT_MAX_PAGES } from "@event-management/contracts/supporting-documents";
