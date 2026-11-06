import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function InputGroup({ leading, trailing, children, className = "", ...props }: {
  leading?: ReactNode;
  trailing?: ReactNode;
} & ComponentPropsWithoutRef<"div">) {
  return (
    <div {...props} className={`input-group${className ? ` ${className}` : ""}`}>
      {leading}
      {children}
      {trailing}
    </div>
  );
}
