export function InclusionStrip({ items }: { items: string[] }) {
  return (
    <ul className="amac-inclusion-strip" aria-label="Package inclusions">
      {items.map((item, index) => (
        <li key={item}>
          <span className="amac-inclusion-strip__number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
