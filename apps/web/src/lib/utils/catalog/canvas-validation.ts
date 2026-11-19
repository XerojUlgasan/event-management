import {
  draftSectionsSchema,
  sectionsSchema,
} from "@event-management/contracts/catalog-canvas";

export function validateCatalogCanvas(
  sections: unknown,
  pendingWidgetIds?: ReadonlySet<string>,
): string | undefined {
  const schema = pendingWidgetIds
    ? draftSectionsSchema(pendingWidgetIds)
    : sectionsSchema;
  const result = schema.safeParse(sections);

  if (result.success) return;

  const issue = result.error.issues[0];
  const [section, field, widget] = issue.path;
  const location = [
    typeof section === "number" ? `Section ${section + 1}` : "Canvas",
    field === "widgets" && typeof widget === "number"
      ? `widget ${widget + 1}`
      : null,
  ].filter(Boolean);

  return `${location.join(", ")}: ${issue.message}`;
}
