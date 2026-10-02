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

export async function fetchWithRetry(url: string, timeout = REQUEST_TIMEOUT, retries = MAX_RETRIES): Promise<FetchResult> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    let delayMs = 1000 * 2 ** (attempt - 1); // Exponential backoff

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      // Read the body before clearing the timeout so the timeout also covers it
      const body = await response.text();
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
      if (attempt === retries) throw error;

      console.error(`Retry ${attempt}/${retries} for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      clearTimeout(timeoutId);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('All retry attempts failed');
}
