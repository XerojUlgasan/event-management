import type { ChangeEvent } from "react";

import { Icon } from "../atoms/Icon";

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  compact = false,
  className = "",
  ariaLabel,
}: {
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`search-field${compact ? " compact" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <Icon name="search" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  );
}
