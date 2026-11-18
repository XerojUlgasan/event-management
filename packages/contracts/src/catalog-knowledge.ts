export type KnowledgeStatus =
  "indexed" | "partial" | "pending" | "needs-refresh";
export type KnowledgeListing = {
  id: string;
  kind: "package" | "service";
  name: string;
  status: KnowledgeStatus;
  indexedChunks: number;
  expectedChunks: number;
  textChunks: number;
  photoChunks: number;
  lastIndexedAt: string | null;
};
export type KnowledgeSummary = {
  packages: { total: number; indexed: number };
  services: { total: number; indexed: number };
  attention: number;
  total: number;
};
export type KnowledgePage = {
  summary: KnowledgeSummary;
  listings: KnowledgeListing[];
  filteredCount: number;
  nextCursor: string | null;
  checkedAt: string;
};
export type KnowledgeChunk = {
  key: string;
  kind: "text" | "photo";
  withdrawn: boolean;
  status: "indexed" | "pending" | "needs-refresh";
  contentMarkdown: string;
  mediaUrl: string | null;
  embeddedAt: string | null;
};
export type KnowledgeDetail = {
  listing: KnowledgeListing;
  chunks: KnowledgeChunk[];
  nextCursor: string | null;
};

export const KNOWLEDGE_SEARCH_MAX_LENGTH = 500;
export const KNOWLEDGE_SEARCH_LIMIT = 5;
export type KnowledgeSearchResult = {
  listing: Pick<KnowledgeListing, "id" | "kind" | "name">;
  key: string;
  kind: "text" | "photo";
  contentMarkdown: string;
  mediaUrl: string | null;
  similarity: number;
};
export type KnowledgeSearchResponse = {
  query: string;
  model: string;
  results: KnowledgeSearchResult[];
};

export type KnowledgeIndexResponse = {
  embedded: number;
  unchanged: number;
  superseded: number;
  failed: number;
  nextCursor: string | null;
};
