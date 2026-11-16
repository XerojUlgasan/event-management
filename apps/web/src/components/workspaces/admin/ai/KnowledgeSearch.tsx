import { useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  Button,
  Panel,
  SearchField,
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

export function KnowledgeSearch() {
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
    <Panel
      as="section"
      className="knowledge-search"
      aria-labelledby="knowledge-search-title"
    >
      <h2 id="knowledge-search-title">Search knowledge</h2>
      <p>Search indexed text and photos by meaning.</p>
      <form className="knowledge-search-form" onSubmit={submit}>
        <SearchField
          value={query}
          onChange={(event) => editQuery(event.target.value)}
          placeholder="Describe what you are looking for"
          ariaLabel="Search knowledge by meaning"
        />
        <Button type="submit" pending={loading} disabled={!query.trim()}>
          Search
        </Button>
      </form>
      {loading && <p role="status">Searching knowledge…</p>}
      {error && (
        <p role="alert" className="knowledge-error">
          {error}
        </p>
      )}
      {!loading && !error && !result && (
        <p>Enter a search to find matching content.</p>
      )}
      {result && (
        <div aria-live="polite">
          <p>
            {result.results.length
              ? `${result.results.length} results for “${result.query}”`
              : `No results for “${result.query}”.`}
          </p>
          <ul className="knowledge-search-results">
            {result.results.map((item) => (
              <li key={`${item.listing.kind}:${item.listing.id}:${item.key}`}>
                <Button
                  variant="plain"
                  className="knowledge-search-result"
                  aria-haspopup="dialog"
                  onClick={() => setPreview(item.listing)}
                >
                  {item.mediaUrl && (
                    <img src={catalogMediaSrc(item.mediaUrl)} alt="" />
                  )}
                  <span>{item.listing.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview && (
        <KnowledgeListingPreview
          key={`${preview.kind}:${preview.id}`}
          listing={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </Panel>
  );
}
