export const MAX_EMAIL_LENGTH = 254;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 120;

/** Letters (any script), combining marks, apostrophes, hyphens, and spaces. */
export const DISPLAY_NAME_REGEX = /^[\p{L}\p{M}'\- ]+$/u;
