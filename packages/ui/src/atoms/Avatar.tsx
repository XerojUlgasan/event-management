export function Avatar({
  initials,
  size = "md",
  className = "",
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "avatar small" : size === "lg" ? "avatar large" : "avatar";

  return (
    <span className={`${sizeClass}${className ? ` ${className}` : ""}`}>
      {initials}
    </span>
  );
}
