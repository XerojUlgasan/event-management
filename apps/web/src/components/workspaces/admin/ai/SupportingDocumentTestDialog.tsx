import {
  SUPPORTING_DOCUMENT_SEARCH_MAX_LENGTH,
  type SupportingDocumentMatch,
} from "@event-management/contracts/supporting-documents";
import {
  Button,
  Dialog,
  FormField,
  Icon,
  Input,
  notificationErrorMessage,
} from "@event-management/ui";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { searchSupportingDocuments } from "../../../../lib/data/ai/supporting-documents";
import { useRequestGeneration } from "../../../../lib/pagination/use-request-generation";

function pageSpan({ pageStart, pageEnd }: SupportingDocumentMatch) {
  return pageStart === pageEnd
    ? `Page ${pageStart}`
    : `Pages ${pageStart}–${pageEnd}`;
}

function timestamp(value: string) {
  return (
    <time dateTime={value}>
      {new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </time>
  );
}

function EmbeddingDetails({
  match,
  onClose,
}: {
  match: SupportingDocumentMatch;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="Embedding details"
      onClose={onClose}
      className="supporting-document-test"
    >
      <dl className="supporting-document-match-metadata">
        <div>
          <dt>Source</dt>
          <dd>{match.filename}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{[pageSpan(match), ...match.headingPath].join(" › ")}</dd>
        </div>
        {match.createdAt && (
          <div>
            <dt>Chunk created</dt>
            <dd>{timestamp(match.createdAt)}</dd>
          </div>
        )}
        <div>
          <dt>Embedded</dt>
          <dd>{timestamp(match.embeddedAt)}</dd>
        </div>
        <div>
          <dt>Embedding model</dt>
          <dd>{match.model}</dd>
        </div>
        <div>
          <dt>Cosine similarity</dt>
          <dd>{match.similarity.toFixed(3)}</dd>
        </div>
      </dl>
      <section className="supporting-document-match-text">
        <h3>Matched text</h3>
        <p>{match.text}</p>
      </section>
    </Dialog>
  );
}

export function SupportingDocumentTestDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRequestGeneration();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SupportingDocumentMatch[] | null>(
    null,
  );
  const [selected, setSelected] = useState<SupportingDocumentMatch | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      generation.bump();
    },
    [generation],
  );

  async function runSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();

    if (!trimmed || searching) return;

    const ticket = generation.bump();
    setSearching(true);
    setError("");
    setMatches(null);

    try {
      const { results } = await searchSupportingDocuments(trimmed);

      if (generation.isCurrent(ticket)) setMatches(results);
    } catch (cause) {
      if (generation.isCurrent(ticket))
        setError(
          notificationErrorMessage(
            cause,
            "Could not search supporting documents.",
          ),
        );
    } finally {
      if (generation.isCurrent(ticket)) setSearching(false);
    }
  }

  return (
    <>
      <Dialog
        title="Test document search"
        onClose={onClose}
        initialFocus={input}
        className="supporting-document-test"
      >
        <form className="supporting-document-test-form" onSubmit={runSearch}>
          <FormField label="Search query">
            {(field) => (
              <Input
                {...field}
                ref={input}
                enterKeyHint="search"
                placeholder="e.g. What does the venue need for setup?"
                maxLength={SUPPORTING_DOCUMENT_SEARCH_MAX_LENGTH}
                value={query}
                onChange={(event) => {
                  generation.bump();
                  setQuery(event.target.value);
                  setMatches(null);
                  setError("");
                  setSearching(false);
                }}
              />
            )}
          </FormField>
          <Button type="submit" disabled={!query.trim()} pending={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>
        <div role="status" className="supporting-document-test-status">
          {matches &&
            (matches.length
              ? `Showing ${matches.length} ${matches.length === 1 ? "passage" : "passages"}`
              : "No embedded passages found.")}
        </div>
        {error && (
          <p role="alert" className="supporting-documents-error">
            {error}
          </p>
        )}
        {matches && matches.length > 0 && (
          <ol
            aria-label="Matching passages"
            className="supporting-document-matches"
          >
            {matches.map((match) => (
              <li key={match.id}>
                <Button
                  variant="plain"
                  className="supporting-document-match"
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    event.currentTarget.focus();
                    setSelected(match);
                  }}
                >
                  <span className="supporting-document-match-content">
                    <span className="supporting-document-match-source">
                      <strong>{match.filename}</strong>
                      <span>{pageSpan(match)}</span>
                    </span>
                    <span className="supporting-document-match-excerpt">
                      {match.text.length > 240
                        ? `${match.text.slice(0, 240).trimEnd()}…`
                        : match.text}
                    </span>
                  </span>
                  <Icon name="chevron" size={16} />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Dialog>
      {selected && (
        <EmbeddingDetails match={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
