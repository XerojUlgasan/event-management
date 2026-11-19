import { Button } from "../atoms/Button";

type Navigation =
  | {
      onPrevious: () => void;
      onNext: () => void;
      previousHref?: never;
      nextHref?: never;
    }
  | {
      previousHref?: string;
      nextHref?: string;
      onPrevious?: never;
      onNext?: never;
    };

export type PaginationProps = Navigation & {
  page: number;
  hasNextPage: boolean;
  pending?: boolean;
  disabled?: boolean;
  label?: string;
};

/** Controlled navigation for tables, cards, and server-rendered collection pages. */
export function Pagination({
  page,
  hasNextPage,
  pending = false,
  disabled = false,
  label = "Results pages",
  ...navigation
}: PaginationProps) {
  const previousDisabled = disabled || pending || page <= 1;
  const nextDisabled = disabled || pending || !hasNextPage;
  const linkClass = "button button-secondary button-size-small";

  return (
    <nav className="ui-pagination" aria-label={label} aria-busy={pending}>
      {navigation.onPrevious ? (
        <Button
          variant="secondary"
          size="small"
          disabled={previousDisabled}
          onClick={navigation.onPrevious}
        >
          Previous
        </Button>
      ) : navigation.previousHref && !previousDisabled ? (
        <a className={linkClass} href={navigation.previousHref} rel="prev">
          Previous
        </a>
      ) : (
        <Button variant="secondary" size="small" disabled>
          Previous
        </Button>
      )}
      <span role="status" aria-live="polite">
        {pending ? `Loading page ${page}…` : `Page ${page}`}
      </span>
      {navigation.onNext ? (
        <Button
          variant="secondary"
          size="small"
          disabled={nextDisabled}
          onClick={navigation.onNext}
        >
          Next
        </Button>
      ) : navigation.nextHref && !nextDisabled ? (
        <a className={linkClass} href={navigation.nextHref} rel="next">
          Next
        </a>
      ) : (
        <Button variant="secondary" size="small" disabled>
          Next
        </Button>
      )}
    </nav>
  );
}
