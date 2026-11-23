import { useRef } from "react";

export function createRequestGeneration() {
  let generation = 0;

  return {
    current: () => generation,
    bump: () => ++generation,
    isCurrent: (ticket: number) => generation === ticket,
  };
}

/** Ignore a response that belongs to an older request or an unmounted effect. */
export function useRequestGeneration() {
  const generation = useRef<ReturnType<typeof createRequestGeneration> | null>(
    null,
  );

  if (!generation.current) generation.current = createRequestGeneration();

  return generation.current;
}
