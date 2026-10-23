export function SectionCounter({ current, total }: { current: number; total: number }) {
  return (
    <span className="cl-section-counter" aria-label={`Section ${current} of ${total}`}>
      <span>{String(current).padStart(2, "0")}</span>
      <span aria-hidden="true">/</span>
      <span>{String(total).padStart(2, "0")}</span>
    </span>
  );
}
