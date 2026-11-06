import type { ChangeEvent, HTMLInputTypeAttribute } from "react";

import { Icon } from "../atoms/Icon";
import { Input } from "../atoms/Input";
import { InputGroup } from "./InputGroup";

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  compact = false,
  className = "",
  ariaLabel,
  type = "text",
}: {
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
  type?: HTMLInputTypeAttribute;
}) {
  return (
    <InputGroup
      leading={<Icon name="search" />}
      className={`search-field${compact ? " compact" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <Input
        variant="plain"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
    </InputGroup>
  );
}
