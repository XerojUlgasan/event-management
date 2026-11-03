# Docs

Create or edit durable Clemora documents, proposals, capstone chapters, reports, guides, and SOPs. Use for an editable document or file deliverable; ordinary chat explanations can remain in chat.

Use the [documentation agent](../AGENT.md) for source authority, task routing, and recursive review. This workflow owns the artifact: its structure, edits, format, and delivery.

## Choose the artifact

- Resolve the destination and current editable source before writing. Follow an existing template and citation style. Clemora product scope, implementation status, and setup belong in the root [README](../../../../README.md); seed and interview material stay in their existing files. Create another project document only when the task requires a distinct artifact, and link it from the README when useful.
- Preserve a requested format. For an existing `.docx`, Word template, comments, or tracked changes, use the available Word/document skill. For PDF creation or inspection, use the available PDF skill. For connected Google Docs, use the connected document tools and applicable skill. Check available capabilities before promising an export or collaboration feature.
- For a historical source, preserve the source and use a clearly identified current draft when revision or removal of the source was not requested.
- Keep a request for chat notes or an explanation in chat. Do not create a separate document merely because the answer is long.

## Draft or revise

1. Read the existing document, its linked requirements and evidence, and any required institutional template. Investigate technical claims in current source/configuration before carrying them into a rewrite; understand the affected flow and distinguish intended changes from implemented behavior. Build an outline only when the structure needs work; do not replace a working chapter layout by default.
2. Write for the actual audience. For repository guides, use current commands, paths, API contracts, and observed verification boundaries. For papers, distinguish background evidence, approved requirements, proposed design, completed work, results, and limitations.
3. Preserve the user's terminology, approved scope, quotations, citations, tables, and figures. Link supporting sources close to the relevant claims. Use source notes instead of invented filler when evidence is missing.
4. Route missing evidence or related-work synthesis to [research-desk](research-desk.md). Route an unresolved idea or scope design to [design-it-capstones](design-it-capstones.md); an approved project does not need to be reinvented.
5. Apply the [recursive review](recursive-review.md). For a polish request, fix supported substantive issues first, then use [humanize-text](humanize-text.md) for prose and finish formatting.

## Deliver

Inspect the actual saved artifact. Verify changed technical claims against current source/configuration and run behavior checks when the claim needs runtime evidence. Then verify local links and cross-references for Markdown; render and visually inspect paginated outputs with the format-specific tools. Link and command-existence checks alone do not establish factual accuracy. Make only exports requested or needed for the deliverable, and report any unavailable conversion or visual check.

Return a link to the edited file or authorized connected document, summarize material changes, and identify remaining evidence gaps. Creating a document does not by itself authorize sending it to other people or publishing it.
