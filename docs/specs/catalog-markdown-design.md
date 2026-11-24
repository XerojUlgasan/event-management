# Catalog Markdown design brief

For administrators writing in the **Packages** and **Services** editors, and contributors maintaining their demo seed copy. Design each widget around a question the customer is trying to answer, such as how the event feels, what the price covers, how the day runs, or what the venue needs to provide.

## Build a listing customers can use

| Customer need | Package copy | Service copy |
| --- | --- | --- |
| Picture the experience | Describe the occasion, the guests and the moments that define the event. | Describe where the service fits into the event and how guests or staff use it. |
| Understand the offer | Name the meal, equipment, staffing and time included in the fixed total. | State the deliverables, quantities and staffing. Distinguish the booking window, active service time and any extension. |
| Follow the day | Put arrival, key cues and closing moments in order where the sequence matters. | Explain what happens at load-in, opening, service and handover when the order affects coordination. |
| Prepare a request | Ask for the headcount, room plan, access or fallback details that affect this package. | Ask for the inputs the provider actually needs, such as the run sheet, a power point or an approved print proof. |

Keep the name, summary, event type, price and capacity or billing fields authoritative. When a widget needs a number to explain the scope, use the same number, unit and qualifier as the listing. For example, a five-hour booking window can include up to three hours of drink service. Keep separately arranged items and extra-time coverage explicit. Describe venue requirements as things to confirm for the event.

Put the most decision-relevant sentence early in each widget. Use short paragraphs for the guest experience or advice with context. Use bullets for a set of inclusions or preparation items and numbering when changing the order would change the plan. Keep a condition next to the offer it limits. The seeded listings aim for roughly 100 words per widget so customers have enough detail to plan. Let the actual decision determine the length in an editor.

## Patterns to paste and adapt

### A guest experience in prose

Use the section title **The concept**.

```md
After the civil signing, gather up to 36 relatives for a family merienda.
The three-hour reception leaves time for travel from the ceremony, a shared
meal and portraits with both sides of the family.

If only a few relatives attend the signing, share the reception address and
arrival time with everyone else so they can join you at the table.
```

### A short program with an actionable constraint

Use the section title **Five hours together**.

```md
1. **Vows.** Open with the procession and outdoor ceremony.
2. **Portraits and refreshments.** Take group portraits while guests move
   from the lawn to their tables.
3. **Dinner and speeches.** Serve the Filipino buffet before speeches,
   then cue the first dance.
4. **Dancing and farewells.** Leave the last hour open for dancing and
   farewells.
```

Use the section title **Make the rain plan first**.

```md
> **Covered fallback.** Choose a covered space at the same venue that can
> hold all 100 guests.

### Access in either layout

Confirm who makes the weather decision. Check the guest routes, the aisle
between the tables and the power for sound and lights.
```

### A service menu with two genuine choices

Use the section title **Choose four drinks**.

```md
Plan up to **100 serves for 50 guests** across four drinks. Here is an
example menu.

| Cocktail | Alcohol-free |
| --- | --- |
| Calamansi gin fizz | Cucumber lime soda |
| Pineapple rum cooler | Ginger citrus spritz |

The service includes a portable counter, two staff, ice, garnishes, cups
and a printed menu. Confirm substitutions before printing.
```

### A handoff the client can prepare

Use the section title **Send the details that are hard to improvise**.

```md
Send the emcee the latest run sheet and mark anything that may still change.

- **Entrances and speakers.** Include names, roles and running order. A short
  voice recording can help with unfamiliar names.
- **Customs and surprises.** Flag details the host should handle carefully.
- **Day-of contact.** Name the person who can move or skip an item and share
  their contact details.
```

## Write for the preview

- Enter the section title in its own field. It renders as a level-two heading below the listing name. Use `###` for a genuine subdivision, with `####` only beneath it. Start directly with prose or a list when the section title already gives enough context.
- Let wording carry meaning. Use bold for a short lead-in or a critical quantity, and reserve a short blockquote for conditions a customer might otherwise miss. Use ordinary Markdown. Keep custom markup, embeds and manual spacing out of the widget.
- Use a table only when the column headers make a genuine comparison easier to read. Prefer two short columns and a few rows, and put qualifiers in nearby prose. Write descriptive text for any link. Use the photo widget and its alt field for images so the picture has a clear description.
- Keep each customer-facing fact in readable words, including the units and the relationship between them. Catalog knowledge preparation includes authored Markdown and section titles. The public package search box matches listing names and descriptions. Distinctive terms such as *civil wedding*, *Filipino buffet*, *18 Roses* and *wireless handheld microphones* are useful when they describe what the listing actually offers.

## Review before publishing

1. Open the package or service editor, select the Markdown widget, and enter the copy. Use **Preview** to check that the heading order and widget reading order make sense when photos stack.
2. Inspect the public detail at 320 px, 390 px and a desktop width such as 1280 px. Read to the last line of every edited widget. Check list markers and indentation, quote wrapping, table labels, page overflow and spacing before the next widget.
3. Confirm that photos load and that their alt text is useful. Tab through any links and check that readers can tell where each one goes. Read the content without styling to confirm the terms and sequence still make sense.
4. Compare the result against the saved metadata and the source agreement before publishing. After saving, reopen the detail and check the copy and any separate service links.

## See it on fresh and existing data

A fresh disposable database seeded with the current [package collection](../../apps/api/src/db/seed/package-collection.ts) and [service collection](../../apps/api/src/db/seed/service-collection.ts) stores the revised Markdown in the created canvases. To preview the 20 sample listings, use a verified disposable database and private Storage target, then follow the [seed guide](../SEED.md).

On an existing catalog the seed preserves saved Markdown, widget sizes and administrator edits. Open a listing in its editor to adopt a pattern selectively, then save and check the public detail.

The authoring editor uses saved rows. If you need more room to read a widget while editing, adjust its height there. With the catalog layout redesign, the public canvas and full preview let Markdown take the height its content needs. Older renderers use saved heights in those views too, so check for clipping or large gaps when previewing the seed on its own. Saved placement, width and order still shape the redesigned wide layout.
