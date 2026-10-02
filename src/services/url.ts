const SAFE_SEGMENT = /^[\w.-]+$/;

/**
 * Turns a scraped href into an absolute spring.io URL, or undefined when there is no usable link.
 */
export function absoluteSpringUrl(link: string | undefined): string | undefined {
  const trimmed = link?.trim();
  if (!trimmed) return undefined;
  try {
    const resolved = new URL(trimmed, 'https://spring.io/');
    return /^https?:$/.test(resolved.protocol) ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates a user-supplied value used as a single URL path segment and returns it encoded.
 */
export function assertSafeSegment(value: string, label: string): string {
  if (!SAFE_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error(`Invalid ${label}: "${value}" (allowed: letters, digits, ".", "_", "-")`);
  }
  return encodeURIComponent(value);
}

const VERSION_PATTERN = /^\d+\.\d+(\.\d+)?$/;

/**
 * Normalizes a user-supplied documentation version to "major.minor" (the patch is ignored).
 * Returns undefined for the current documentation (absent, empty or "current").
 * Throws on any other format, before anything reaches a URL.
 */
export function normalizeVersion(version?: string): string | undefined {
  if (version === undefined || version === '' || version === 'current') return undefined;
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid version "${version}": expected a version like "3.4" or "3.4.2", or "current"`);
  }
  return version.split('.').slice(0, 2).join('.');
}
