import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

export type FormFieldControlProps = {
  id: string;
  "aria-labelledby": string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

export function FormField({
  label,
  children,
  description,
  error,
  htmlFor,
  className = "",
  ...props
}: {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  children?: ReactNode | ((props: FormFieldControlProps) => ReactNode);
} & Omit<ComponentPropsWithRef<"label">, "children">) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const hasDescription = Boolean(description);
  const hasError = Boolean(error);
  const describedBy = [hasDescription && `${controlId}-description`, hasError && `${controlId}-error`].filter(Boolean).join(" ") || undefined;
  const renderControl = typeof children === "function";

  return (
    <label
      {...props}
      htmlFor={renderControl ? controlId : htmlFor}
      className={[renderControl && "ui-field", className].filter(Boolean).join(" ") || undefined}
      data-invalid={hasError || undefined}
    >
      <span id={renderControl ? `${controlId}-label` : undefined}>{label}</span>
      {renderControl ? children({ id: controlId, "aria-labelledby": `${controlId}-label`, "aria-invalid": hasError || undefined, "aria-describedby": describedBy }) : children}
      {hasDescription && <small className="ui-field-description" id={`${controlId}-description`}>{description}</small>}
      {hasError && <small className="ui-field-error" id={`${controlId}-error`}>{error}</small>}
    </label>
  );
}
