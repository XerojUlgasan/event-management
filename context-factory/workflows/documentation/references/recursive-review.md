# Recursive review and paper polish

## Discover the affected material

1. Start from the user's target files and requested task. Use `rg --files` to inventory relevant files recursively; include Markdown, manuscript formats, templates, bibliography files, figures, tables, and appendices. For repository tasks, inspect the root README, `docs/`, relevant `context-factory/` guidance, and changed files. Respect ignored private files; exclude dependencies and build outputs.
2. Read the target and its parent index or table of contents. Follow relevant local links, chapter references, citations, appendices, figure/table references, and source-code references. Search for incoming mentions of changed concepts, names, fields, routes, and scope decisions, including documents that are not linked from the target.
3. Track visited paths to avoid cycles. Continue until no unvisited material relevant to the task remains. Recursion follows documentation dependencies; it does not repeatedly invoke the router or expand the assignment to unrelated papers or application changes.
4. Distinguish editable current documents from historical proposals, raw interviews, quotations, templates, and external evidence. Preserve source records and unrelated working-tree changes. Report conflicts rather than rewriting evidence to agree with a new narrative.

For a long or multi-session task, keep a compact working ledger beside the current draft or in its existing project notes. Record files/sections covered, findings, supporting evidence, required fixes, and unresolved decisions. Keep private source data out of the ledger. A short edit can use a working checklist without adding a permanent file.

## Review substance before wording

Use a findings list with location, issue, evidence, impact, and resolution. Check applicable dimensions:

| Dimension | Questions |
| --- | --- |
| Problem and objectives | Does the evidence establish the client's actual problem? Do objectives address it without overstating demand or benefit? |
| Scope and system description | Do title, abstract, chapters, diagrams, requirements, and conclusions describe the same system, actors, boundaries, and implementation status? |
| Literature and references | Does each cited source exist, and does the accessible text support the associated claim? Are citations and bibliography entries matched in both directions? |
| Methodology | Can the design, sampling, instruments, procedures, analysis, and evaluation answer the stated questions? Are planned procedures distinguishable from completed work? |
| Results and conclusions | Are numbers, units, sample sizes, tables, and interpretations consistent? Do conclusions follow from actual results, with limitations stated? |
| Traceability | Can a reader follow problem → objective → requirement/design → evaluation → result → conclusion? For proposals, mark evaluation and results as planned. |
| Supporting material | Do diagrams, captions, appendices, glossary terms, cross-references, and examples agree with the narrative? Are sensitive details removed appropriately? |

Use [research-desk](../../research/references/research-desk.md) for evidence and referee review, [validate-it-capstones](../../research/references/validate-it-capstones.md) when the proposal's viability is in question, and [docs](docs.md) to make authorized revisions. Do not fabricate missing interviews, respondents, statistics, references, experiments, implementation, or results. Keep unverified claims visibly unresolved in working notes and out of asserted conclusions.

## Revise and polish in order

1. Resolve supported factual errors, contradictions, scope drift, and missing argument links. Distinguish an edit from a new research or business decision. Ask when a material decision cannot be inferred from approved sources; continue independent fixes.
2. Repair organization and transitions: give each section a clear purpose, remove repetition, align headings with the template, and connect objectives, methods, and evaluation.
3. Use [humanize-text](humanize-text.md) for English prose. Preserve citations, numerical values, technical meaning, voice, and uncertainty. Do not make unsupported claims sound more certain.
4. Normalize terminology, acronyms, tense, spelling, citation style, numbering, captions, tables, and cross-references. Preserve required template text and verbatim quotations. Do not impose a particular citation style without a requirement or established pattern.
5. Review the affected chapter again, then its parent document and dependent sections. Repeat only where edits create or expose an unresolved material issue. When the same issue requires unavailable evidence or a user decision, record that dependency and stop cycling on it.

## Verify the delivered artifact

- Markdown: inspect the diff, local links and images, anchors, heading structure, tables, code fences, and stale references. Check commands and paths against source when they are part of the edit; do not execute destructive setup commands as a documentation check.
- Word/PDF or another paginated format: use the available format-specific skill and render the actual deliverable. Inspect every rendered page for clipping, broken tables, orphaned headings, misplaced captions, missing figures, and pagination. Re-render after layout changes; text extraction alone is not visual proof.
- Check bibliography/citation correspondence and referenced tables, figures, appendices, and section numbers. Verify external sources when needed and label inaccessible or unverified material.
- Inspect the full edited scope and confirm that unrelated files and historical sources were preserved. Run relevant code checks only if code changed; a build cannot establish manuscript quality or system behavior.

The review is complete when the requested scope is covered, supported edits are made, affected dependencies agree, and appropriate checks pass. Report unresolved substantive issues and unavailable checks explicitly. For a review-only request, deliver findings without editing. For a polish request, deliver the revised artifact and the remaining limitations.
