import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  resolveWikiDocument,
  wikiPageName,
  wikiPageUrl,
  expectedWikiTitle,
  extractWikiMarkdown,
  selectSections,
} from '../src/services/boot-wiki.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const GUIDE_URL = 'https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide';

describe('resolveWikiDocument', () => {
  it('auto: x.0 gives the migration guide, other minors the release notes', () => {
    expect(resolveWikiDocument('3.0', 'auto')).toBe('migration-guide');
    expect(resolveWikiDocument('3.4', 'auto')).toBe('release-notes');
    expect(resolveWikiDocument('4.0', 'auto')).toBe('migration-guide');
  });

  it('an explicit document wins over auto', () => {
    expect(resolveWikiDocument('3.0', 'release-notes')).toBe('release-notes');
    expect(resolveWikiDocument('3.4', 'migration-guide')).toBe('migration-guide');
  });
});

describe('page name, title and url', () => {
  it('builds names, titles and urls for both documents', () => {
    expect(wikiPageName('3.0', 'migration-guide')).toBe('Spring-Boot-3.0-Migration-Guide');
    expect(wikiPageName('3.4', 'release-notes')).toBe('Spring-Boot-3.4-Release-Notes');
    expect(expectedWikiTitle('3.0', 'migration-guide')).toBe('Spring Boot 3.0 Migration Guide');
    expect(expectedWikiTitle('3.4', 'release-notes')).toBe('Spring Boot 3.4 Release Notes');
    expect(wikiPageUrl('Spring-Boot-3.0-Migration-Guide')).toBe(GUIDE_URL);
  });
});

describe('extractWikiMarkdown', () => {
  it('extracts a clean markdown body from the real page structure', () => {
    const { markdown, title } = extractWikiMarkdown(
      fixture('boot-wiki-migration-guide.html'),
      'Spring Boot 3.0 Migration Guide',
      GUIDE_URL,
    );
    expect(title).toBe('Spring Boot 3.0 Migration Guide');
    expect(markdown).toContain('## Before You Start');
    expect(markdown).toContain('### Jakarta EE');
    expect(markdown).toContain('#### Jakarta EE Servlet');
    expect(markdown).toContain('```');
    expect(markdown).not.toContain('](#');
    expect(markdown).not.toContain('<svg');
    expect(markdown).not.toContain('Uh oh!');
    expect(markdown).not.toContain('Wiki pages');
    expect(markdown).not.toContain('Code');
    expect(markdown).not.toContain('Supported Versions');
  });

  it('keeps pre blocks without a code child as fenced blocks', () => {
    const { markdown } = extractWikiMarkdown(
      fixture('boot-wiki-migration-guide.html'),
      'Spring Boot 3.0 Migration Guide',
      GUIDE_URL,
    );
    expect(markdown).toContain('<dependency>');
    expect(markdown).toMatch(/```[\s\S]*<dependency>[\s\S]*```/);
  });

  it('rejects the wiki home page served for a missing page', () => {
    expect(() =>
      extractWikiMarkdown(fixture('boot-wiki-home.html'), 'Spring Boot 3.0 Migration Guide', GUIDE_URL),
    ).toThrow(/page not found/);
  });

  it('rejects a page whose title only partially matches', () => {
    const html = fixture('boot-wiki-migration-guide.html').replace(
      '<title>Spring Boot 3.0 Migration Guide ·',
      '<title>Spring Boot 3.0 Migration Guide (draft) ·',
    );
    expect(() => extractWikiMarkdown(html, 'Spring Boot 3.0 Migration Guide', GUIDE_URL)).toThrow(
      /page not found/,
    );
  });

  it('rejects a page without title', () => {
    expect(() => extractWikiMarkdown('<html><body></body></html>', 'Spring Boot 3.0 Migration Guide', GUIDE_URL)).toThrow(
      /page not found/,
    );
  });

  it('fails when the wiki body is missing', () => {
    const html = '<html><head><title>Spring Boot 3.0 Migration Guide · spring-projects/spring-boot Wiki · GitHub</title></head><body><p>x</p></body></html>';
    expect(() => extractWikiMarkdown(html, 'Spring Boot 3.0 Migration Guide', GUIDE_URL)).toThrow(
      /Unable to extract content/,
    );
  });
});

describe('selectSections', () => {
  const md = [
    '## Before You Start',
    'Intro.',
    '## Upgrade to Spring Boot 3',
    '### Jakarta EE',
    'Jakarta text.',
    '#### Jakarta EE Servlet',
    'Servlet text.',
    '## Web Application Changes',
    'Web text.',
  ].join('\n');

  it('returns the matching section with its sub-sections only', () => {
    const out = selectSections(md, 'jakarta', 'Guide');
    expect(out).toContain('### Jakarta EE');
    expect(out).toContain('#### Jakarta EE Servlet');
    expect(out).toContain('Servlet text.');
    expect(out).not.toContain('Web Application Changes');
    expect(out).not.toContain('Before You Start');
    expect(out.match(/Jakarta text\./g)).toHaveLength(1);
  });

  it('is case-insensitive on both sides', () => {
    expect(selectSections(md, 'JAKARTA', 'Guide')).toContain('### Jakarta EE');
    expect(selectSections(md, 'web APPLICATION', 'Guide')).toContain('Web text.');
  });

  it('joins disjoint matches with a blank line', () => {
    expect(selectSections('# A\nx\n# B\ny\n# A b\nz', 'a', 'Guide')).toBe('# A\nx\n\n# A b\nz');
  });

  it('does not duplicate nested matches', () => {
    const out = selectSections(md, 'e', 'Guide');
    expect(out.match(/Servlet text\./g)).toHaveLength(1);
    expect(out.match(/Jakarta text\./g)).toHaveLength(1);
  });

  it('a level-1 title matching the keyword covers the whole document', () => {
    const doc = '# Guide Foo\n## One\na\n## Two\nb';
    expect(selectSections(doc, 'foo', 'Guide')).toBe(doc);
  });

  it('handles a match in last position and CRLF input', () => {
    const out = selectSections('## A\r\nx\r\n## Last\r\ny\r\n', 'last', 'Guide');
    expect(out).toBe('## Last\ny');
  });

  it('does not treat a comment inside a code block as a heading', () => {
    const doc = ['## Setup', '```bash', '# commentaire', 'run it', '```', '## Other', 'z'].join('\n');
    expect(() => selectSections(doc, 'commentaire', 'Guide')).toThrow(/No section matching "commentaire"/);
    expect(selectSections(doc, 'setup', 'Guide')).toBe(['## Setup', '```bash', '# commentaire', 'run it', '```'].join('\n'));
  });

  it('a heading right after a code block still ends the section', () => {
    const doc = ['## Setup', '```', '# c', '```', '## Other', 'z'].join('\n');
    expect(selectSections(doc, 'other', 'Guide')).toBe('## Other\nz');
  });

  it('matches keywords with spaces and regex special characters literally', () => {
    const doc = '## C++ (legacy)\na\n## Other\nb';
    expect(selectSections(doc, 'c++ (', 'Guide')).toBe('## C++ (legacy)\na');
    expect(() => selectSections(doc, '.*', 'Guide')).toThrow(/No section matching/);
  });

  it('lists the available headings when nothing matches', () => {
    expect(() => selectSections(md, 'zzz', 'Spring Boot 3.0 Migration Guide')).toThrow(
      /No section matching "zzz".*Available sections: .*Jakarta EE/,
    );
  });

  it('truncates a very long list of available headings', () => {
    const doc = Array.from({ length: 100 }, (_, i) => `## H${i}\nx`).join('\n');
    let message = '';
    try {
      selectSections(doc, 'zzz', 'Guide');
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('H79');
    expect(message).not.toContain('H80,');
    expect(message.endsWith('…')).toBe(true);
  });
});
