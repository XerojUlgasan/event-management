/** Letters, spaces, hyphens, and apostrophes only; at least one letter required. */
const PERSON_NAME_PATTERN = /^[\p{L}][\p{L}\s'-]*$/u;

export function sanitizePersonNameInput(value: string) {
  return value.replace(/[^\p{L}\s'-]/gu, "");
}

export function isValidPersonName(value: string) {
  const trimmed = value.trim();

  return (
    trimmed.length > 0 &&
    PERSON_NAME_PATTERN.test(trimmed) &&
    /\p{L}/u.test(trimmed)
  );
}

export function personNameValidationMessage(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "Enter a name.";

  if (sanitizePersonNameInput(value).trim() !== trimmed)
    return "Use only letters, spaces, hyphens, and apostrophes.";

  if (!isValidPersonName(value)) return "Enter a valid name.";

  return "";
}