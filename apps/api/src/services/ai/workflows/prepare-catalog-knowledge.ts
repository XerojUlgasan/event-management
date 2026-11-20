import type { CatalogSection } from "@event-management/contracts/catalog";
import type { Selectable } from "kysely";
import type { Packages, Services } from "../../../db/types.js";
import { includedServiceTermsLines } from "../catalog-service-terms.js";

type PackageRecord = Pick<
  Selectable<Packages>,
  | "id"
  | "name"
  | "description"
  | "price"
  | "max_guests"
  | "package_type"
  | "archived_at"
>;

type ServiceRecord = Pick<
  Selectable<Services>,
  | "id"
  | "name"
  | "description"
  | "hourly_rate_pesos"
  | "fixed_price_pesos"
  | "included_hours"
  | "archived_at"
>;

export type PrepareCatalogKnowledgeInput =
  | {
      kind: "package";
      record: PackageRecord;
      sections: CatalogSection[];
    }
  | {
      kind: "service";
      record: ServiceRecord;
      sections: CatalogSection[];
    };

type PreparedCatalogKnowledgeChunk = {
  chunkKey: string;
  contentMarkdown: string;
  mediaId: string | null;
};

function listingLabel(input: PrepareCatalogKnowledgeInput) {
  return `Catalog ${input.kind}: ${input.record.name}`;
}

function nonemptyLine(label: string, value: string) {
  return value ? [`${label}: ${value}`] : [];
}

function packageOverview(record: PackageRecord) {
  const lines = [
    "Catalog package",
    `Name: ${record.name}`,
    ...nonemptyLine("Description", record.description),
    `Price: PHP ${record.price} per package.`,
    `Capacity: up to ${record.max_guests} guests.`,
  ];

  return lines.join("\n");
}

function serviceOverview(record: ServiceRecord) {
  const lines = [
    "Catalog service",
    `Name: ${record.name}`,
    ...nonemptyLine("Description", record.description),
  ];

  if (record.fixed_price_pesos !== null && record.included_hours !== null) {
    lines.push(
      `Fixed price: PHP ${record.fixed_price_pesos} for ${record.included_hours} included hours.`,
    );

    if (record.hourly_rate_pesos !== null)
      lines.push(`Additional time: PHP ${record.hourly_rate_pesos} per hour.`);
  } else if (record.hourly_rate_pesos !== null) {
    lines.push(`Hourly rate: PHP ${record.hourly_rate_pesos} per hour.`);
  } else if (record.fixed_price_pesos !== null) {
    lines.push(`Fixed price: PHP ${record.fixed_price_pesos}.`);
  }

  return lines.join("\n");
}

function prepareSections(input: PrepareCatalogKnowledgeInput) {
  const text: string[] = [];
  const photos: PreparedCatalogKnowledgeChunk[] = [];

  for (const section of input.sections) {
    const widgets = section.widgets
      .map((widget, index) => ({ widget, index }))
      .sort(
        (left, right) =>
          left.widget.y - right.widget.y ||
          left.widget.x - right.widget.x ||
          left.index - right.index,
      );

    for (const { widget } of widgets) {
      if (widget.type === "video") continue;

      const context = `${listingLabel(input)}\nSection: ${section.title}`;

      if (widget.type === "service" || widget.type === "package") {
        if (input.kind === "package" && widget.type === "service")
          text.push(
            [
              context,
              `Included service ID: ${widget.serviceId ?? "not specified"}`,
              ...includedServiceTermsLines(widget.serviceTerms),
              ...nonemptyLine("Caption", widget.caption),
            ].join("\n"),
          );
        else if (widget.caption)
          text.push(`${context}\nCaption: ${widget.caption}`);

        continue;
      }

      if (widget.type === "markdown") {
        text.push(`${context}\nMarkdown:\n${widget.markdown}`);
        continue;
      }

      photos.push({
        chunkKey: `photo:${widget.id}`,
        contentMarkdown: [
          context,
          ...nonemptyLine("Alt text", widget.alt),
          ...nonemptyLine("Caption", widget.caption),
        ].join("\n"),
        mediaId: widget.media?.id ?? null,
      });
    }
  }

  return { text, photos };
}

export function prepareCatalogKnowledge(
  input: PrepareCatalogKnowledgeInput,
): PreparedCatalogKnowledgeChunk[] {
  if (input.kind === "package") {
    if (
      input.record.package_type !== "catalog" ||
      input.record.archived_at !== null
    )
      return [];
  } else if (input.record.archived_at !== null) return [];

  const overview =
    input.kind === "package"
      ? packageOverview(input.record)
      : serviceOverview(input.record);

  const { text, photos } = prepareSections(input);

  return [
    {
      chunkKey: "text",
      contentMarkdown: [overview, ...text].join("\n\n"),
      mediaId: null,
    },
    ...photos,
  ];
}
