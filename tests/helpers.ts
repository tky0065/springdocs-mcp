import { readFileSync } from "node:fs";
import { vi } from "vitest";

export const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/** Minimal stand-in for a node-fetch Response, as used by the services. */
export function fakeResponse(status: number, body = "", headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
  };
}

/** Awaits a promise while advancing fake timers, so retry backoffs elapse instantly. */
export async function settle<T>(promise: Promise<T>) {
  let done = false;
  const outcome = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  ).finally(() => { done = true; });
  while (!done) {
    await vi.advanceTimersByTimeAsync(1000);
  }
  return outcome;
}
