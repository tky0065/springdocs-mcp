/**
 * Release notes helpers: pure functions used by the get_release_notes tool.
 */

export type ReleaseFocus = 'all' | 'breaking-changes' | 'new-features' | 'deprecations';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/;
const MINOR_PATTERN = /^\d+\.\d+$/;
const STABLE_PATCH_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const BREAKING_PATTERN = /breaking|remov(e|ed|al)|incompatib|no longer|migrat/i;
const DEPRECATION_PATTERN = /deprecat/i;
const HEADING_PATTERN = /^(#{1,6})\s/;

/**
 * Normalizes a user-supplied release version: strips a leading "v", returns
 * undefined for absent/empty/"latest" and throws on any invalid format.
 * Accepts a full version ("3.5.0", "4.2.0-M2") or a minor ("3.5").
 */
export function normalizeReleaseVersion(version?: unknown): string | undefined {
  if (version === undefined || version === null || version === '' || version === 'latest') {
    return undefined;
  }
  if (typeof version !== 'string') {
    throw new Error(
      `Invalid version ${JSON.stringify(version)}: expected a string like "3.5.0", "3.5" or "4.2.0-M2"`
    );
  }
  const normalized = version.startsWith('v') ? version.slice(1) : version;
  if (!VERSION_PATTERN.test(normalized) && !MINOR_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid version "${version}": expected a release version like "3.5.0", "3.5" (latest release of that minor) or "4.2.0-M2"`
    );
  }
  return normalized;
}

/** True for a normalized "X.Y" minor (as opposed to a full release version). */
export function isMinorVersion(normalized: string): boolean {
  return MINOR_PATTERN.test(normalized);
}

/**
 * Among GitHub releases, the highest stable (X.Y.Z, no pre-release) patch of the given
 * "X.Y" minor, or undefined. Numeric comparison: 3.1 never matches 3.10.
 */
export function latestStableOfMinor<T extends { tag_name?: unknown; prerelease?: unknown }>(
  releases: T[],
  minor: string,
  tagPrefix = ''
): T | undefined {
  let best: T | undefined;
  let bestPatch = -1;
  for (const release of releases) {
    if (typeof release?.tag_name !== 'string' || release.prerelease === true) continue;
    let tag = release.tag_name;
    if (tagPrefix && tag.startsWith(tagPrefix)) tag = tag.slice(tagPrefix.length);
    else if (tag.startsWith('v')) tag = tag.slice(1);
    const match = STABLE_PATCH_PATTERN.exec(tag);
    if (!match || `${match[1]}.${match[2]}` !== minor) continue;
    const patch = Number(match[3]);
    if (patch > bestPatch) {
      best = release;
      bestPatch = patch;
    }
  }
  return best;
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
