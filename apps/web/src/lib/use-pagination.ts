import { useCallback, useState } from "react";
type History = { scope: string; cursors: (string | undefined)[]; index: number };
const firstPage = (scope: string): History => ({ scope, cursors: [undefined], index: 0 });
/** Cursor history belongs to the current filter/parent scope, never another list. */
export function usePagination(scope: string) {
  const [history, setHistory] = useState<History>(() => firstPage(scope));
  const current = history.scope === scope ? history : firstPage(scope);
  // Persist the transition so returning to an earlier filter cannot revive its old cursor.
  if (history.scope !== scope) setHistory(current);
  const next = useCallback((nextCursor: string | null) => {
    if (!nextCursor) return;
    setHistory(previous => {
      const value = previous.scope === scope ? previous : firstPage(scope);
      return { scope, cursors: [...value.cursors.slice(0, value.index + 1), nextCursor], index: value.index + 1 };
    });
  }, [scope]);
  const previous = useCallback(() => setHistory(value => value.scope === scope ? { ...value, index: Math.max(0, value.index - 1) } : firstPage(scope)), [scope]);
  const reset = useCallback(() => setHistory(firstPage(scope)), [scope]);
  return { cursor: current.cursors[current.index], page: current.index + 1, next, previous, reset };
}
