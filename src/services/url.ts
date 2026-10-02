const SAFE_SEGMENT = /^[\w.-]+$/;

/**
 * Turns a scraped href into an absolute spring.io URL, or undefined when there is no usable link.
 */
export function absoluteSpringUrl(link: string | undefined): string | undefined {
  const trimmed = link?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://spring.io/${trimmed.replace(/^\/+/, '')}`;
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
