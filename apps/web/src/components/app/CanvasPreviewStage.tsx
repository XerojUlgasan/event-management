import type { ReactNode } from "react"

/**
 * Centers a catalog canvas preview and pins it to the authoring canvas width,
 * so the customer view keeps the widget sizes seen in the editor instead of
 * growing to fill a wider window. Stacked mode follows the same measured-width
 * check as the editor rather than a viewport media query.
 */
export function CanvasPreviewStage({ width, children }: { width: number; children: ReactNode }) {
  return <div className={`pe-preview-stage${width < 520 ? " pe-preview-stacked" : ""}`} style={{ width: Math.max(0, width - 2) }}>{children}</div>
}