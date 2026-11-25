export const PH_MOBILE_COUNTRY_CODE = "+63";

const LOCAL_DIGIT_COUNT = 10;

/** Normalize stored or pasted values to up to 10 national digits (9XXXXXXXXX). */
export function parsePhilippineMobileDigits(value: string) {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("63")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  return digits.slice(0, LOCAL_DIGIT_COUNT);
}

export function sanitizePhilippineMobileDigitInput(value: string) {
  return parsePhilippineMobileDigits(value).replace(/[^\d]/g, "");
}

export function formatPhilippineMobileDisplay(localDigits: string) {
  if (!localDigits) return "";

  const segments = [
    localDigits.slice(0, 3),
    localDigits.slice(3, 6),
    localDigits.slice(6, 10),
  ].filter(Boolean);

  return segments.join(" ");
}

export function isValidPhilippineMobile(localDigits: string) {
  return /^9\d{9}$/.test(localDigits);
}

export function philippineMobileValidationMessage(localDigits: string) {
  if (!localDigits) return "Enter your mobile number.";

  if (!localDigits.startsWith("9"))
    return "Philippine mobile numbers start with 9 after +63.";

  if (localDigits.length < LOCAL_DIGIT_COUNT)
    return `Enter ${LOCAL_DIGIT_COUNT} digits after +63.`;

  if (!isValidPhilippineMobile(localDigits))
    return "Enter a valid Philippine mobile number.";

  return "";
}

export function formatPhilippineMobileStorage(localDigits: string) {
  if (!isValidPhilippineMobile(localDigits)) return "";

  const grouped = formatPhilippineMobileDisplay(localDigits);

  return `${PH_MOBILE_COUNTRY_CODE} ${grouped}`;
}