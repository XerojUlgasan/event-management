BEGIN;

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '';

-- Preserve each existing card's first-Markdown excerpt as its editable description.
-- Future canvas edits no longer rewrite this text.
UPDATE packages AS p
SET description = left(btrim(regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(first_markdown.markdown, $rx$!\[([^\]]*)\]\([^)]*\)$rx$, $replacement$\1$replacement$, 'g'),
          $rx$\[([^\]]+)\]\([^)]*\)$rx$, $replacement$\1$replacement$, 'g'),
        '<[^>]*>', ' ', 'g'),
      $rx$^[#>\s*-]+$rx$, '', 'gn'),
    '[`*_~]', '', 'g'),
  $rx$\s+$rx$, ' ', 'g')), 400)
FROM (
  SELECT DISTINCT ON (page.package_id) page.package_id, widget.markdown
  FROM catalog_pages AS page
  JOIN catalog_sections AS section ON section.page_id = page.id
  JOIN catalog_widgets AS widget ON widget.section_id = section.id
  WHERE page.package_id IS NOT NULL AND widget.type = 'markdown'
  ORDER BY page.package_id, section.sort_order, widget.sort_order
) AS first_markdown
WHERE p.id = first_markdown.package_id;

COMMIT;
