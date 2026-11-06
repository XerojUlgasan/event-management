export function Avatar({
  initials,
  size = "md",
  className = "",
  tone = "default",
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  tone?: "default" | "accent";
}) {
  const sizeClass =
    size === "sm" ? "avatar small" : size === "lg" ? "avatar large" : "avatar";

  return (
    <span className={`${sizeClass}${tone === "accent" ? " avatar-accent" : ""}${className ? ` ${className}` : ""}`}>
      {initials}
    </span>
  );
}
