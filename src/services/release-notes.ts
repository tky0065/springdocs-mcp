/**
 * Release notes helpers: pure functions used by the get_release_notes tool.
 */

export type ReleaseFocus = 'all' | 'breaking-changes' | 'new-features' | 'deprecations';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/;
const BREAKING_PATTERN = /breaking|remov(e|ed|al)|incompatib|no longer|migrat/i;
const DEPRECATION_PATTERN = /deprecat/i;
const HEADING_PATTERN = /^(#{1,6})\s/;

/**
 * Normalizes a user-supplied release version: strips a leading "v", returns
 * undefined for absent/empty/"latest" and throws on any invalid format.
 */
export function normalizeReleaseVersion(version?: string): string | undefined {
  if (version === undefined || version === '' || version === 'latest') {
    return undefined;
  }
  const normalized = version.startsWith('v') ? version.slice(1) : version;
  if (!VERSION_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid version "${version}": expected a release version like "3.5.0" or "4.2.0-M2"`
    );
  }
  return normalized;
}

/** Filters a GitHub release body according to the requested focus. */
export function filterReleaseBody(body: string | null | undefined, focus: ReleaseFocus): string {
  if (!body) return '';
  if (focus === 'all') return body;

  // GitHub sometimes returns CRLF line endings
  const lines = body.split(/\r?\n/);

  if (focus === 'new-features') {
    const result: string[] = [];
    let level = 0; // 0 = not inside the section
    for (const line of lines) {
      const heading = HEADING_PATTERN.exec(line);
      if (level === 0) {
        if (heading && /new features/i.test(line)) {
          level = heading[1].length;
          result.push(line);
        }
      } else {
        if (heading && heading[1].length <= level) break;
        result.push(line);
      }
    }
    return result.join('\n').trim();
  }

  const pattern = focus === 'breaking-changes' ? BREAKING_PATTERN : DEPRECATION_PATTERN;
  return lines
    .filter((line) => !HEADING_PATTERN.test(line) && pattern.test(line))
    .join('\n');
}
