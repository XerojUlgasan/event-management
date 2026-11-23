export function showcasePageLinks(url: URL, nextCursor: string | null) {
  const cursor = url.searchParams.get("cursor");
  const history = url.searchParams.getAll("previous");

  const link = (current: string | undefined, previous: string[]) => {
    const params = new URLSearchParams();
    if (current) params.set("cursor", current);
    for (const item of previous) params.append("previous", item);
    const query = params.toString();
    return `${url.pathname}${query ? `?${query}` : ""}`;
  };

  return {
    previous: history.length
      ? link(history.at(-1), history.slice(0, -1))
      : null,
    next: nextCursor ? link(nextCursor, [...history, cursor ?? ""]) : null,
  };
}
