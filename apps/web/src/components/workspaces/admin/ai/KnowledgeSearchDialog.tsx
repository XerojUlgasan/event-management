import { useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  Button,
  Dialog,
  Icon,
  Input,
  InputGroup,
  useNotifications,
} from "@event-management/ui";
import {
  KNOWLEDGE_SEARCH_MAX_LENGTH,
  type KnowledgeSearchResponse,
  type KnowledgeSearchResult,
} from "@event-management/contracts/catalog-knowledge";
import { searchKnowledge } from "../../../../lib/data/ai/knowledge";
import { catalogMediaSrc } from "../../../../lib/data/catalog/media";
import { KnowledgeListingPreview } from "./KnowledgeListingPreview";

export function KnowledgeSearchDialog({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<KnowledgeSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<
    KnowledgeSearchResult["listing"] | null
  >(null);
  const sequence = useRef(0);
  const { notifyError } = useNotifications();

  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );

  function editQuery(value: string) {
    sequence.current++;
    setQuery(value.slice(0, KNOWLEDGE_SEARCH_MAX_LENGTH));
    setResult(null);
    setError("");
    setLoading(false);
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) return;

    const current = ++sequence.current;
    setResult(null);
    setError("");
    setLoading(true);

    try {
      const response = await searchKnowledge(trimmed);

      if (sequence.current === current) setResult(response);
    } catch (cause) {
      if (sequence.current === current) {
        setError(notifyError(cause, "Unable to search knowledge."));
      }
    } finally {
      if (sequence.current === current) setLoading(false);
    }
  }

  return (
    <>
      <Dialog
        title="Search knowledge"
        intro="Search indexed text and photos by meaning."
        onClose={onClose}
        initialFocus={input}
      >
        <form className="knowledge-search-form" onSubmit={submit}>
          <InputGroup leading={<Icon name="search" />}>
            <Input
              ref={input}
              variant="plain"
              value={query}
              onChange={(event) => editQuery(event.target.value)}
              maxLength={KNOWLEDGE_SEARCH_MAX_LENGTH}
              enterKeyHint="search"
              placeholder="Describe what you are looking for"
              aria-label="Search knowledge by meaning"
            />
          </InputGroup>
          <Button type="submit" pending={loading} disabled={!query.trim()}>
            Search
          </Button>
        </form>
        {loading && (
          <p role="status" className="knowledge-search-status">
            Searching knowledge…
          </p>
        )}
        {error && (
          <p role="alert" className="knowledge-search-status knowledge-error">
            {error}
          </p>
        )}
        {result && (
          <>
            <p role="status" className="knowledge-search-status">
              {result.results.length
                ? `${result.results.length} ${result.results.length === 1 ? "result" : "results"} for “${result.query}”`
                : `No results for “${result.query}”.`}
            </p>
            {result.results.length > 0 && (
              <ul
                aria-label="Matching listings"
                className="knowledge-search-results"
              >
                {result.results.map((item) => (
                  <li
                    key={`${item.listing.kind}:${item.listing.id}:${item.key}`}
                  >
                    <Button
                      variant="plain"
                      className="knowledge-search-result"
                      aria-haspopup="dialog"
                      onClick={(event) => {
                        event.currentTarget.focus();
                        setPreview(item.listing);
                      }}
                    >
                      {item.mediaUrl && (
                        <img src={catalogMediaSrc(item.mediaUrl)} alt="" />
                      )}
                      <span>{item.listing.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Dialog>
      {preview && (
        <KnowledgeListingPreview
          key={`${preview.kind}:${preview.id}`}
          listing={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
