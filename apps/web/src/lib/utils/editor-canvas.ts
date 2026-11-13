/**
 * Content width of the authoring canvas inside `.pe-canvas-area`.
 *
 * Preview surfaces render at this width so a story shows the widget sizes the
 * author sees, instead of stretching to the preview container. Keep the values
 * in sync with the layout breakpoints in `styles/package-editor.css`:
 * - above 800px the sidebar is 230px and the canvas pads 5% each side
 * - 520-800px the sidebar is 150px and the canvas pads 12px each side
 * - at or below 520px the sidebar moves above the canvas and only the 12px
 *   canvas padding remains
 */
export const editorCanvasWidth = (viewportWidth: number) => {
  if (viewportWidth <= 520) return Math.max(0, viewportWidth - 24)
  if (viewportWidth <= 800) return Math.max(0, viewportWidth - 174)
  return Math.max(0, viewportWidth * 0.9 - 230)
}