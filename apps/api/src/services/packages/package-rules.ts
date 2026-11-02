export const error = (message: string, status: 400 | 404 | 409) => ({
  message,
  status,
});
export function nextUpdate(previous: Date) {
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}
