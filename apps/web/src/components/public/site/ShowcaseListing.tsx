import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Toast } from "@event-management/ui";
import {
  getPublicShowcasesPage,
  type ShowcasePage,
} from "../../../lib/data/showcases/showcases";
import { showcasePageLinks } from "../../../lib/pagination/showcase-page-links";
import { ShowcaseExpanded } from "../showcase/ShowcaseExpanded";

type Props = { initialPage: ShowcasePage; initialUrl: string };

export function ShowcaseListing({ initialPage, initialUrl }: Props) {
  const [{ showcases, nextCursor, url }, setPage] = useState({
    ...initialPage,
    url: initialUrl,
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "failed" | "retrying"
  >("idle");
  const pending = useRef(false);
  const loadedCursors = useRef(
    new Set(new URL(initialUrl).searchParams.getAll("cursor")),
  );
  const nextLink = useRef<HTMLAnchorElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const retryFocus = useRef<number | null>(null);
  const { next } = showcasePageLinks(new URL(url), nextCursor);
  const { previous } = showcasePageLinks(new URL(initialUrl), null);

  const loadMore = useCallback(
    async (retry = false) => {
      if (!nextCursor || !next || pending.current) return;
      pending.current = true;
      setStatus(retry ? "retrying" : "loading");

      try {
        const page = await getPublicShowcasesPage(nextCursor);
        if (
          page.nextCursor &&
          (page.nextCursor === nextCursor ||
            loadedCursors.current.has(page.nextCursor))
        ) {
          throw new Error("Showcase pagination returned an earlier cursor.");
        }

        loadedCursors.current.add(nextCursor);
        if (retry) retryFocus.current = showcases.length;
        setPage((current) => {
          const records = new Map(
            current.showcases.map((item) => [item.id, item]),
          );
          for (const item of page.showcases) {
            if (!records.has(item.id)) records.set(item.id, item);
          }
          return {
            showcases: [...records.values()],
            nextCursor: page.nextCursor,
            url: new URL(next, current.url).href,
          };
        });
        setStatus("idle");
      } catch {
        setStatus("failed");
      } finally {
        pending.current = false;
      }
    },
    [next, nextCursor, showcases.length],
  );

  useEffect(() => {
    const link = nextLink.current;
    if (
      !link ||
      status !== "idle" ||
      typeof IntersectionObserver === "undefined"
    )
      return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || document.activeElement === link) return;
        observer.disconnect();
        void loadMore();
      },
      { rootMargin: "0px 0px 200px" },
    );
    observer.observe(link);
    return () => observer.disconnect();
  }, [loadMore, status]);

  useEffect(() => {
    const index = retryFocus.current;
    retryFocus.current = null;
    if (index === null || document.activeElement !== document.body) return;

    const titles = list.current?.querySelectorAll<HTMLAnchorElement>("h2 a");
    (titles?.[index] ?? nextLink.current ?? titles?.[index - 1])?.focus();
  }, [showcases]);

  const loading = status === "loading" || status === "retrying";

  return (
    <>
      {showcases.length ? (
        <div ref={list} className="showcase-list" aria-busy={loading}>
          {showcases.map((item) => (
            <ShowcaseExpanded key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="catalog-status">
          No showcases published yet. Check back soon.
        </p>
      )}

      {(status === "failed" || status === "retrying") && (
        <Toast tone="danger" placement="inline">
          <span>More showcases couldn’t be loaded.</span>
          <Button
            variant="secondary"
            size="small"
            aria-busy={status === "retrying"}
            aria-disabled={status === "retrying"}
            onClick={() => void loadMore(true)}
          >
            {status === "retrying" ? "Retrying…" : "Try again"}
          </Button>
        </Toast>
      )}

      {(previous || next) && (
        <nav className="showcase-list-navigation" aria-label="Showcase pages">
          {previous && (
            <a className="button button-secondary" href={previous} rel="prev">
              Previous page
            </a>
          )}
          {next && (
            <a
              ref={nextLink}
              className="button button-secondary"
              href={next}
              rel="next"
            >
              Next page
            </a>
          )}
        </nav>
      )}
      {status === "loading" && (
        <p className="catalog-status" role="status">
          Loading showcases…
        </p>
      )}
    </>
  );
}
