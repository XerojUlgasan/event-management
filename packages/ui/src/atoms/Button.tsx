import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Button({
  children,
  variant = "primary",
  onClick,
  icon,
  type = "button",
  className = "",
  disabled = false,
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "light"
  onClick?: () => void
  icon?: string
  type?: "button" | "submit"
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  )
}

