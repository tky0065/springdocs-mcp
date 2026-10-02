import fetch from 'node-fetch';
import { USER_AGENT } from '../version.js';

export interface FetchResult {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<any>;
}

export const REQUEST_TIMEOUT = 10000;
export const MAX_RETRIES = 3;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MiB

export const MAX_REDIRECTS = 5;
export const ALLOWED_REDIRECT_HOSTS: ReadonlySet<string> = new Set([
  'docs.spring.io',
  'spring.io',
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com'
]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

class ResponseTooLargeError extends Error {
  constructor(url: string) {
    super(`Response from ${url} exceeds the 5 MiB limit`);
  }
}

/** A refused redirect (host, protocol, loop, too many hops): never retried. */
class RedirectError extends Error {}

export async function fetchWithRetry(url: string, timeout = REQUEST_TIMEOUT, retries = MAX_RETRIES): Promise<FetchResult> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    let delayMs = 1000 * 2 ** (attempt - 1); // Exponential backoff

    try {
      // Redirects are followed manually (always GET) so every hop can be checked
      let currentUrl = url;
      const visited = new Set<string>([url]);
      let redirects = 0;
      let response;
      for (;;) {
        response = await fetch(currentUrl, {
          signal: controller.signal,
          size: MAX_RESPONSE_BYTES,
          redirect: 'manual',
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        // Reject early when the server announces a body above the limit
        const declaredLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
          throw new ResponseTooLargeError(currentUrl);
        }
        const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get('location') : null;
        if (!location) break; // not a followable redirect: returned as is
        // The body of a redirect is useless: discard it without reading
        (response as { body?: { resume?: () => void } }).body?.resume?.();

        let next: URL;
        try {
          next = new URL(location, currentUrl);
        } catch {
          throw new RedirectError(`Invalid redirect Location from ${currentUrl}: ${location}`);
        }
        if (next.protocol !== 'https:') {
          throw new RedirectError(`Redirect to disallowed protocol ${next.protocol} from ${currentUrl}`);
        }
        if (!ALLOWED_REDIRECT_HOSTS.has(next.hostname)) {
          throw new RedirectError(`Redirect to disallowed host ${next.hostname} from ${currentUrl}`);
        }
        if (visited.has(next.href)) {
          throw new RedirectError(`Redirect loop detected at ${next.href}`);
        }
        if (++redirects > MAX_REDIRECTS) {
          throw new RedirectError(`Too many redirects (more than ${MAX_REDIRECTS}) starting from ${url}`);
        }
        visited.add(next.href);
        currentUrl = next.href;
      }
      // Read the body before clearing the timeout so the timeout also covers it
      let body: string;
      try {
        body = await response.text();
      } catch (error) {
        // node-fetch aborts the read once `size` is exceeded
        if ((error as { type?: string }).type === 'max-size') throw new ResponseTooLargeError(url);
        throw error;
      }
      const result: FetchResult = {
        ok: response.ok,
        status: response.status,
        text: async () => body,
        json: async () => JSON.parse(body)
      };

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === retries) return result;

      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
      if (Number.isFinite(retryAfter) && retryAfter >= 0) {
        delayMs = Math.min(retryAfter * 1000, 10000);
      }
      console.error(`Retry ${attempt}/${retries} for ${url}: HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof ResponseTooLargeError || error instanceof RedirectError) throw error; // never retried
      if (attempt === retries) throw error;

      console.error(`Retry ${attempt}/${retries} for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      clearTimeout(timeoutId);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('All retry attempts failed');
}
