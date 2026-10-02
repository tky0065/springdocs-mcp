import * as cheerio from 'cheerio';
import { turndownService } from './markdown.js';

// Pure helpers for reading Spring Boot migration guides and release notes from
// the GitHub wiki of spring-projects/spring-boot. No network access here.

export type WikiDocument = 'migration-guide' | 'release-notes';

const WIKI_BASE_URL = 'https://github.com/spring-projects/spring-boot/wiki/';
const MAX_LISTED_SECTIONS = 80;

/** `auto` picks the migration guide for x.0 versions and the release notes otherwise. */
export function resolveWikiDocument(version: string, document: 'auto' | WikiDocument): WikiDocument {
  if (document !== 'auto') return document;
  return version.endsWith('.0') ? 'migration-guide' : 'release-notes';
}

function documentLabel(document: WikiDocument): string {
  return document === 'migration-guide' ? 'Migration Guide' : 'Release Notes';
}

export function wikiPageName(version: string, document: WikiDocument): string {
  return `Spring-Boot-${version}-${documentLabel(document).replace(' ', '-')}`;
}

export function wikiPageUrl(pageName: string): string {
  return `${WIKI_BASE_URL}${pageName}`;
}

export function expectedWikiTitle(version: string, document: WikiDocument): string {
  return `Spring Boot ${version} ${documentLabel(document)}`;
}

/**
 * Convert the wiki page HTML to markdown.
 *
 * GitHub answers a missing wiki page with a redirect to the wiki home page,
 * which is followed transparently and returns 200. The page <title> must
 * therefore match the expected title EXACTLY, otherwise the page is considered
 * absent and the home page content is never returned as a guide.
 */
export function extractWikiMarkdown(
  html: string,
  expectedTitle: string,
  url: string,
): { markdown: string; title: string } {
  const $ = cheerio.load(html);

  const title = $('title').first().text().split(' · spring-projects')[0].trim();
  if (title !== expectedTitle) {
    const pageName = decodeURIComponent(url.split('/').pop() ?? url);
    throw new Error(`Spring Boot wiki page not found: ${pageName} (${url})`);
  }

  const body = $('#wiki-body .markdown-body').first();
  if (body.length === 0) {
    throw new Error(`Unable to extract content from ${url}`);
  }

  // Heading permalinks and icons would otherwise leak as "[](#...)" links.
  body.find('a.anchor, svg, .octicon').remove();
  body.find('a[href^="#"]').each((_, el) => {
    if ($(el).text().trim() === '') $(el).remove();
  });

  // GitHub renders highlighted blocks as <pre> without <code>, which turndown
  // would not fence: normalise them to <pre><code>.
  body.find('pre').each((_, el) => {
    const pre = $(el);
    if (pre.children('code').length === 0) {
      const code = $('<code></code>').text(pre.text());
      pre.empty().append(code);
    }
  });

  const markdown = turndownService.turndown(body.html() ?? '').trim();
  if (!markdown) {
    throw new Error(`Unable to extract content from ${url}`);
  }
  return { markdown, title };
}

interface Heading {
  line: number;
  level: number;
  text: string;
}

function findHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) headings.push({ line: index, level: match[1].length, text: match[2] });
  });
  return headings;
}

/**
 * Keep the sections whose heading contains the keyword (case-insensitive),
 * each with its sub-sections. Matches nested in an already selected range are
 * skipped; ranges are joined by a blank line.
 */
export function selectSections(markdown: string, keyword: string, title: string): string {
  const lines = markdown.split(/\r?\n/);
  const headings = findHeadings(lines);
  const needle = keyword.toLowerCase();

  const ranges: string[] = [];
  let coveredUntil = 0;
  headings.forEach((heading, i) => {
    if (heading.line < coveredUntil) return;
    if (!heading.text.toLowerCase().includes(needle)) return;
    const next = headings.slice(i + 1).find((h) => h.level <= heading.level);
    const end = next ? next.line : lines.length;
    ranges.push(lines.slice(heading.line, end).join('\n').trimEnd());
    coveredUntil = end;
  });

  if (ranges.length === 0) {
    const titles = headings.slice(0, MAX_LISTED_SECTIONS).map((h) => h.text).join(', ');
    const more = headings.length > MAX_LISTED_SECTIONS ? '…' : '';
    throw new Error(`No section matching "${keyword}" in ${title}. Available sections: ${titles}${more}`);
  }
  return ranges.join('\n\n');
}
