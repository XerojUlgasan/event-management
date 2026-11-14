import type { ComponentPropsWithRef } from "react";
import { Icon, type IconName } from "./Icon";

export function Button({
  children,
  variant = "primary",
  size = "default",
  onClick,
  icon,
  type = "button",
  className = "",
  disabled = false,
  pending = false,
  ...props
}: {
  variant?:
    "primary" | "secondary" | "ghost" | "light" | "plain" | "link" | "danger";
  size?: "default" | "small" | "icon";
  icon?: IconName;
  pending?: boolean;
} & ComponentPropsWithRef<"button">) {
  return (
    <button
      {...props}
      type={type}
      className={
        [
          variant === "plain" ? "ui-button-plain" : "button",
          variant !== "plain" && `button-${variant}`,
          size !== "default" && `button-size-${size}`,
          className,
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending || props["aria-busy"]}
    >
      {pending ? (
        <Icon name="spinner" size={17} />
      ) : (
        icon && <Icon name={icon} size={17} />
      )}
      {children}
    </button>
  );
}
