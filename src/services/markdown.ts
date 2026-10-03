import TurndownService from 'turndown';

export const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

/** An open fenced code block: its fence character and the length of the opening fence. */
export interface Fence {
  char: '`' | '~';
  length: number;
}

const OPENING_FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const CLOSING_FENCE = /^\s*(`{3,}|~{3,})\s*$/;

/**
 * Fence state after `line`, given the state before it (null = outside a code block).
 * An opening fence is 3+ backticks or tildes (a backtick fence cannot carry
 * backticks in its info string); a closing fence uses the same character, is at
 * least as long as the opening one and carries nothing but whitespace.
 */
export function advanceFence(state: Fence | null, line: string): Fence | null {
  if (state) {
    const close = CLOSING_FENCE.exec(line);
    if (close && close[1][0] === state.char && close[1].length >= state.length) return null;
    return state;
  }
  const open = OPENING_FENCE.exec(line);
  if (!open) return null;
  const char = open[1][0] as '`' | '~';
  if (char === '`' && open[2].includes('`')) return null;
  return { char, length: open[1].length };
}

/** The fence line that closes (or reopens) a block opened with `fence`. */
export function fenceMarker(fence: Fence): string {
  return fence.char.repeat(fence.length);
}

export interface FenceLine {
  /** Whether the line begins inside a fenced code block. */
  inCode: boolean;
  /** The open fence at the start of the line (null when outside a block). */
  fence: Fence | null;
  /** Whether the line is itself an opening or closing fence. */
  isFence: boolean;
  /** The open fence after this line (null when outside a block). */
  after: Fence | null;
}

/** Code-fence state of every line, in one pass. Single source of truth for all fence tracking. */
export function scanFences(lines: readonly string[]): FenceLine[] {
  let state: Fence | null = null;
  return lines.map((line) => {
    const before = state;
    state = advanceFence(before, line);
    return { inCode: before !== null, fence: before, isFence: (before === null) !== (state === null), after: state };
  });
}

export const DETAIL_LIMITS: Record<string, number> = {
  summary: 1500,
  medium: 4000,
  full: 50000,
};

/**
 * Keep the beginning of a markdown document within the detail level's budget.
 * The cut happens on a line boundary; a code block cut in the middle is closed
 * so the result stays valid markdown.
 */
export function extractContent(markdown: string, detailLevel: string = 'medium'): { content: string; truncated: boolean } {
  const maxLength = DETAIL_LIMITS[detailLevel] ?? DETAIL_LIMITS.medium;
  if (markdown.length <= maxLength) return { content: markdown, truncated: false };

  const kept: string[] = [];
  let length = 0;
  let fence: Fence | null = null;
  for (const line of markdown.split('\n')) {
    if (length + line.length + 1 > maxLength) break;
    kept.push(line);
    length += line.length + 1;
    fence = advanceFence(fence, line);
  }

  // A first line longer than the budget leaves nothing: hard-cut it instead
  if (kept.length === 0) {
    const firstLine = markdown.split('\n', 1)[0];
    const open = advanceFence(null, firstLine);
    const first = markdown.slice(0, maxLength);
    return { content: open ? `${first}\n${fenceMarker(open)}` : first, truncated: true };
  }

  let content = kept.join('\n').trimEnd();
  if (fence) content += `\n${fenceMarker(fence)}`;
  return { content, truncated: true };
}

export const PAGE_SIZE = 4000;

interface Line extends FenceLine {
  start: number;
  text: string;
}

/** Split into lines with their start position and code-fence state, in one pass. */
function scanLines(markdown: string): Line[] {
  const texts: string[] = [];
  const starts: number[] = [];
  let start = 0;
  while (start < markdown.length) {
    const newline = markdown.indexOf('\n', start);
    const end = newline === -1 ? markdown.length : newline;
    texts.push(markdown.slice(start, end));
    starts.push(start);
    start = end + 1;
  }
  return scanFences(texts).map((fence, i) => ({ ...fence, start: starts[i], text: texts[i] }));
}

/**
 * Return one page of a markdown document starting at `offset`.
 * The page ends at a clean boundary: before a heading, else after a blank line
 * (both only outside code blocks and past the middle of the window), else on a
 * line boundary, else a hard cut for a single huge line. A code block cut by the
 * page boundary is closed here and reopened at the start of the next page.
 * `start`/`end` are positions in the original markdown (`end` exclusive);
 * `nextOffset` is `end` when content remains, else null.
 */
export function pageMarkdown(
  markdown: string,
  offset: number = 0,
  pageSize: number = PAGE_SIZE,
): { content: string; start: number; end: number; nextOffset: number | null; total: number } {
  const total = markdown.length;
  if (offset >= total) return { content: '', start: offset, end: offset, nextOffset: null, total };

  const lines = scanLines(markdown);
  // Fence state at a position = state at the start of the line containing it
  const stateAt = (position: number): Fence | null => {
    let found = lines[0];
    for (const line of lines) {
      if (line.start > position) break;
      found = line;
    }
    return found.fence;
  };

  const startFence = stateAt(offset);
  const windowEnd = Math.min(total, offset + pageSize);
  let end = windowEnd;

  if (windowEnd < total) {
    let heading = -1;
    let blank = -1;
    let anyLine = -1;
    lines.forEach((line, index) => {
      // Candidate boundaries are line starts strictly after `offset`, within the window
      if (line.start <= offset || line.start > windowEnd) return;
      anyLine = line.start;
      if (line.inCode || line.start < offset + pageSize / 2) return;
      if (/^#{1,6}\s/.test(line.text)) heading = line.start;
      else if (lines[index - 1].text === '') blank = line.start;
    });
    end = heading !== -1 ? heading : blank !== -1 ? blank : anyLine !== -1 ? anyLine : windowEnd;
  }

  let content = markdown.slice(offset, end);
  if (startFence) content = `${fenceMarker(startFence)}\n${content}`;
  const endFence = end < total ? stateAt(end) : null;
  if (endFence) content = content.replace(/\n?$/, `\n${fenceMarker(endFence)}`);
  return { content, start: offset, end, nextOffset: end < total ? end : null, total };
}
