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

  let content = kept.join('\n').trimEnd();
  if (inCodeBlock) content += '\n```';
  return { content, truncated: true };
}
