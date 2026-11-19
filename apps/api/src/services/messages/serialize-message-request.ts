// Share a pending request within this worker. PostgreSQL remains the replay guard
// across workers; each worker cleans any redundant staged objects after replay.
const pending = new Map<string, Promise<unknown>>();
export async function serializeMessageRequest<T>(
  requestId: string | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (!requestId) return operation();
  const previous = pending.get(requestId);
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  pending.set(requestId, current);
  await previous?.catch(() => {});
  try {
    return await operation();
  } finally {
    release();
    if (pending.get(requestId) === current) pending.delete(requestId);
  }
}
