/**
 * In-memory BM25 full-text index over documentation pages already read by the server.
 * Pure module: no network, no dependency.
 */

export interface SearchHit {
  docId: string;
  title: string;
  url: string;
  score: number;
  snippet: string;
}

interface IndexedDoc {
  title: string;
  url: string;
  text: string;
  tf: Map<string, number>;
  length: number;
}

const K1 = 1.2;
const B = 0.75;
const TITLE_WEIGHT = 3;
const DEFAULT_MAX_CHARS = 8_000_000;
const SNIPPET_BEFORE = 80;
const SNIPPET_AFTER = 120;
const FALLBACK_SNIPPET = 200;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "with", "what", "when", "which", "you", "your",
]);

const keep = (token: string): boolean => token.length > 1 && !STOPWORDS.has(token);

/** Lowercased tokens; dotted/dashed keys (spring.datasource.url) are kept whole and also split. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.toLowerCase().matchAll(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g)) {
    const token = match[0];
    if (keep(token)) tokens.push(token);
    if (/[.-]/.test(token)) {
      for (const part of token.split(/[.-]/)) {
        if (keep(part)) tokens.push(part);
      }
    }
  }
  return tokens;
}

export class SearchIndex {
  private readonly maxChars: number;
  private readonly docs = new Map<string, IndexedDoc>();
  private readonly df = new Map<string, number>();
  private totalLength = 0;
  private totalChars = 0;

  constructor(opts: { maxChars?: number } = {}) {
    this.maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  }

  get size(): number {
    return this.docs.size;
  }

  add(docId: string, doc: { title: string; url: string; text: string }): void {
    this.remove(docId);
    const text = doc.text.length > this.maxChars ? doc.text.slice(0, this.maxChars) : doc.text;
    const tf = new Map<string, number>();
    let length = 0;
    for (const token of tokenize(text)) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
      length += 1;
    }
    for (const token of tokenize(doc.title)) {
      tf.set(token, (tf.get(token) ?? 0) + TITLE_WEIGHT);
      length += TITLE_WEIGHT;
    }
    for (const token of tf.keys()) {
      this.df.set(token, (this.df.get(token) ?? 0) + 1);
    }
    this.docs.set(docId, { title: doc.title, url: doc.url, text, tf, length });
    this.totalLength += length;
    this.totalChars += text.length;

    // Evict the oldest pages until the budget holds (the page just added is always last)
    while (this.totalChars > this.maxChars && this.docs.size > 1) {
      const oldest = this.docs.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
  }

  search(query: string, limit: number): SearchHit[] {
    const terms = [...new Set(tokenize(query))];
    if (terms.length === 0 || this.docs.size === 0) return [];

    const n = this.docs.size;
    const avgLength = this.totalLength / n || 1;
    const idf = new Map<string, number>();
    for (const term of terms) {
      const df = this.df.get(term) ?? 0;
      idf.set(term, Math.log(1 + (n - df + 0.5) / (df + 0.5)));
    }

    const scored: Array<{ docId: string; score: number }> = [];
    for (const [docId, doc] of this.docs) {
      let score = 0;
      for (const term of terms) {
        const tf = doc.tf.get(term);
        if (!tf) continue;
        score += (idf.get(term) as number) * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * doc.length / avgLength));
      }
      if (score > 0) scored.push({ docId, score });
    }
    scored.sort((x, y) => y.score - x.score || x.docId.localeCompare(y.docId));

    const byIdf = [...terms].sort((x, y) => (idf.get(y) as number) - (idf.get(x) as number));
    return scored.slice(0, limit).map(({ docId, score }) => {
      const doc = this.docs.get(docId) as IndexedDoc;
      return { docId, title: doc.title, url: doc.url, score, snippet: makeSnippet(doc.text, byIdf) };
    });
  }

  private remove(docId: string): void {
    const doc = this.docs.get(docId);
    if (!doc) return;
    for (const token of doc.tf.keys()) {
      const next = (this.df.get(token) ?? 1) - 1;
      if (next <= 0) this.df.delete(token);
      else this.df.set(token, next);
    }
    this.totalLength -= doc.length;
    this.totalChars -= doc.text.length;
    this.docs.delete(docId);
  }
}

/** ~200 characters around the best term, trimmed to whole words. */
function makeSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  for (const term of terms) {
    const at = lower.indexOf(term);
    if (at < 0) continue;
    let start = Math.max(0, at - SNIPPET_BEFORE);
    let end = Math.min(text.length, at + SNIPPET_AFTER);
    if (start > 0) {
      const space = text.slice(start, at).search(/\s/);
      if (space >= 0) start += space + 1;
    }
    if (end < text.length) {
      const space = text.slice(at, end).search(/\s\S*$/);
      if (space >= 0) end = at + space;
    }
    const body = text.slice(start, end).replace(/\s+/g, " ").trim();
    return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
  }
  return text.slice(0, FALLBACK_SNIPPET).replace(/\s+/g, " ").trim();
}
