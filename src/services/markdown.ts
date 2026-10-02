import TurndownService from 'turndown';

export const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

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
  let inCodeBlock = false;
  for (const line of markdown.split('\n')) {
    if (length + line.length + 1 > maxLength) break;
    kept.push(line);
    length += line.length + 1;
    if (line.trim().startsWith('```')) inCodeBlock = !inCodeBlock;
  }

  // A first line longer than the budget leaves nothing: hard-cut it instead
  if (kept.length === 0) {
    const first = markdown.slice(0, maxLength);
    return { content: first.trim().startsWith('```') ? first + '\n```' : first, truncated: true };
  }

  let content = kept.join('\n').trimEnd();
  if (inCodeBlock) content += '\n```';
  return { content, truncated: true };
}

export const PAGE_SIZE = 4000;

interface Line {
  start: number;
  text: string;
  /** Whether the line begins inside a fenced code block. */
  inCode: boolean;
}

/** Split into lines with their start position and code-fence state, in one pass. */
function scanLines(markdown: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  let inCode = false;
  while (start < markdown.length) {
    const newline = markdown.indexOf('\n', start);
    const end = newline === -1 ? markdown.length : newline;
    const text = markdown.slice(start, end);
    lines.push({ start, text, inCode });
    if (text.trim().startsWith('```')) inCode = !inCode;
    start = end + 1;
  }
  return lines;
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
  const stateAt = (position: number): boolean => {
    let found = lines[0];
    for (const line of lines) {
      if (line.start > position) break;
      found = line;
    }
    return found.inCode;
  };

  const startsInCode = stateAt(offset);
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
  if (startsInCode) content = '```\n' + content;
  if (end < total && stateAt(end)) content = content.replace(/\n?$/, '\n```');
  return { content, start: offset, end, nextOffset: end < total ? end : null, total };
}
