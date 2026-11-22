import {
  extractTextItems,
  getDocumentProxy,
  getResolvedPDFJS,
  type StructuredTextItem,
} from "unpdf";
import { chunkSections, type PreparedChunk } from "./chunk-sections.js";
import { SUPPORTING_DOCUMENT_MAX_PAGES } from "./document-limits.js";
import {
  layoutDocument,
  pageHasMeaningfulText,
  type PositionedText,
} from "./layout-blocks.js";

export type { PreparedChunk as SupportingDocumentChunk } from "./chunk-sections.js";

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

// Bound PDF.js image decoding while distinguishing scans from blank pages.
const MAX_DECODED_IMAGE_PIXELS = 16_777_216;

export type SupportingDocumentFailureCode =
  "invalid_pdf" | "encrypted_pdf" | "page_limit_exceeded" | "aborted";

export type PreparedSupportingDocument =
  | {
      kind: "complete";
      pageCount: number;
      chunks: PreparedChunk[];
    }
  | {
      kind: "needs_review";
      pageCount: number;
      unreadablePages: number[];
    }
  | {
      kind: "failed";
      code: SupportingDocumentFailureCode;
    };

export async function prepareSupportingDocument(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<PreparedSupportingDocument> {
  if (signal?.aborted) return failed("aborted");

  if (bytes.byteLength === 0) return failed("invalid_pdf");

  let pdf: PdfDocument | undefined;

  const onAbort = () => {
    void releasePdf(pdf);
  };

  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const data = new Uint8Array(bytes);

    pdf = await getDocumentProxy(data, {
      maxImageSize: MAX_DECODED_IMAGE_PIXELS,
    });

    if (signal?.aborted) return failed("aborted");

    const pageCount = pdf.numPages;

    if (pageCount > SUPPORTING_DOCUMENT_MAX_PAGES)
      return failed("page_limit_exceeded");

    if (pageCount < 1) return failed("invalid_pdf");

    const extracted = await extractTextItems(pdf);

    if (signal?.aborted) return failed("aborted");

    const unreadablePages = await findUnreadablePages(
      pdf,
      extracted.items,
      signal,
    );

    if (unreadablePages.length > 0)
      return { kind: "needs_review", pageCount, unreadablePages };

    const sections = layoutDocument(extracted.items.map(toPositionedText));
    const chunks = chunkSections(sections);

    return { kind: "complete", pageCount, chunks };
  } catch (error) {
    if (signal?.aborted) return failed("aborted");

    return failed(failureCode(error));
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await releasePdf(pdf);
  }
}

async function releasePdf(pdf: PdfDocument | undefined) {
  if (!pdf) return;

  await pdf.loadingTask.destroy().catch(() => undefined);
}

async function findUnreadablePages(
  pdf: PdfDocument,
  pages: StructuredTextItem[][],
  signal?: AbortSignal,
) {
  const { OPS } = await getResolvedPDFJS();
  const imageOperations = new Set([
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintImageMaskXObject,
    OPS.paintInlineImageXObjectGroup,
    OPS.paintImageMaskXObjectGroup,
    OPS.paintImageXObjectRepeat,
  ]);
  const unreadable: number[] = [];

  for (const [index, items] of pages.entries()) {
    signal?.throwIfAborted();

    if (pageHasMeaningfulText(items.map(toPositionedItem))) continue;

    const page = await pdf.getPage(index + 1);
    const { fnArray } = await page.getOperatorList();
    page.cleanup();

    if (fnArray.some((operation) => imageOperations.has(operation)))
      unreadable.push(index + 1);
  }

  return unreadable;
}

function toPositionedText(items: StructuredTextItem[]): PositionedText[] {
  return items.map(toPositionedItem);
}

function toPositionedItem(item: StructuredTextItem): PositionedText {
  return {
    str: item.str,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    fontSize: item.fontSize,
    fontFamily: item.fontFamily,
    dir: item.dir === "rtl" || item.dir === "ttb" ? item.dir : "ltr",
    hasEOL: item.hasEOL,
  };
}

function failed(
  code: SupportingDocumentFailureCode,
): PreparedSupportingDocument {
  return { kind: "failed", code };
}

function failureCode(error: unknown): SupportingDocumentFailureCode {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (name === "AbortError") return "aborted";

  if (name === "PasswordException" || /password/i.test(message))
    return "encrypted_pdf";

  return "invalid_pdf";
}
