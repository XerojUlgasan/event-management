export type TextRun = { text: string; size: number; x: number; y: number };

export function textPage(runs: TextRun[]): PdfPage {
  return { runs, image: false };
}

export function imagePage(pageNumber?: string): PdfPage {
  return {
    runs: pageNumber ? [{ text: pageNumber, size: 10, x: 300, y: 36 }] : [],
    image: true,
  };
}

export type PdfPage = { runs: TextRun[]; image: boolean };

export function buildPdf(options: {
  pages: PdfPage[];
  title?: string;
}): Uint8Array {
  const encoder = new TextEncoder();
  let nextId = 1;
  const catalogId = nextId++;
  const pagesId = nextId++;
  const fontId = nextId++;
  const infoId = options.title ? nextId++ : 0;

  const plans = options.pages.map((page) => ({
    page,
    imageId: page.image ? nextId++ : 0,
    contentId: nextId++,
    pageId: nextId++,
  }));

  const bodies = new Array<Uint8Array>(nextId - 1);

  const set = (id: number, body: Uint8Array | string) => {
    bodies[id - 1] = typeof body === "string" ? encoder.encode(body) : body;
  };

  set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  set(
    pagesId,
    `<< /Type /Pages /Kids [${plans.map((plan) => `${plan.pageId} 0 R`).join(" ")}] /Count ${plans.length} >>`,
  );
  set(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  if (infoId)
    set(infoId, `<< /Title (${escapePdfText(options.title ?? "")}) >>`);

  for (const plan of plans) {
    if (plan.imageId) set(plan.imageId, imageObject());

    set(
      plan.contentId,
      streamObject(contentStream(plan.page, plan.imageId !== 0)),
    );

    const imageResource = plan.imageId
      ? ` /XObject << /Im1 ${plan.imageId} 0 R >>`
      : "";

    set(
      plan.pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >>${imageResource} >> /Contents ${plan.contentId} 0 R >>`,
    );
  }

  const header = encoder.encode("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  const objects = bodies.map((body, index) =>
    concat(
      encoder.encode(`${index + 1} 0 obj\n`),
      body,
      encoder.encode("\nendobj\n"),
    ),
  );

  let offset = header.length;

  const offsets = objects.map((object) => {
    const start = offset;

    offset += object.length;

    return start;
  });

  const xref = [
    `xref`,
    `0 ${objects.length + 1}`,
    `0000000000 65535 f `,
    ...offsets.map((start) => `${String(start).padStart(10, "0")} 00000 n `),
    `trailer`,
    `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R${infoId ? ` /Info ${infoId} 0 R` : ""} >>`,
    `startxref`,
    `${offset}`,
    `%%EOF`,
  ].join("\n");

  return concat(header, ...objects, encoder.encode(xref));
}

function contentStream(page: PdfPage, image: boolean): Uint8Array {
  const lines = page.runs.map(
    (run) =>
      `BT /F1 ${run.size} Tf 1 0 0 1 ${run.x} ${run.y} Tm (${escapePdfText(run.text)}) Tj ET`,
  );

  if (image) lines.unshift("q 500 0 0 640 56 80 cm /Im1 Do Q");

  return new TextEncoder().encode(lines.join("\n"));
}

function streamObject(data: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();

  return concat(
    encoder.encode(`<< /Length ${data.length} >>\nstream\n`),
    data,
    encoder.encode("\nendstream"),
  );
}

function imageObject(): Uint8Array {
  const width = 8;
  const height = 8;
  const pixels = new Uint8Array(width * height).fill(40);
  const encoder = new TextEncoder();
  const header = encoder.encode(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`,
  );

  return concat(header, pixels, encoder.encode("\nendstream"));
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);

  const bytes = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
}
