import { setTimeout as sleep } from "node:timers/promises";

export async function waitForWorkerDelay(ms: number, signal: AbortSignal) {
  try {
    await sleep(ms, undefined, { signal });
  } catch (error) {
    if (!signal.aborted) throw error;
  }
}
