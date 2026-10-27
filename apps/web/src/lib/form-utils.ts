import { useState } from "react";

/**
 * Reusable form state hook. Manages form data and errors.
 * Extracted from PackagesPage pattern.
 */
export function useFormState<T extends Record<string, any>>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = <K extends keyof T>(key: K, value: T[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const clearErrors = () => setErrors({});

  const reset = () => {
    setForm(initial);
    clearErrors();
  };

  return { form, setForm, setField, errors, setErrors, clearErrors, reset };
}

/**
 * Extract error message from unknown error (ApiError or Error).
 * Reused pattern from PackagesPage.
 */
export function message(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}
