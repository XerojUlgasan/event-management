export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark">C</span>
      <span>Clemora</span>
    </div>
  );
}
