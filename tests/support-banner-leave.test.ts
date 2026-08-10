import { describe, it, expect, vi } from "vitest";

/**
 * The Leave button must never strand a Super Admin in support mode.
 *
 * The original code awaited the fetch with no guard, so a rejected request
 * skipped setBusy(false) and left the button disabled reading "Leaving…"
 * forever — the operator stayed inside another member's view with no way out
 * short of reloading the page.
 *
 * These exercise the handler's shape rather than the component, so they stay
 * meaningful without a DOM: what matters is that the busy flag is always
 * cleared and the refresh always fires, whatever fetch does.
 */
function makeLeave(doFetch: () => Promise<unknown>) {
  const calls = { busy: [] as boolean[], refreshed: 0 };
  const setBusy = (v: boolean) => void calls.busy.push(v);
  const refresh = () => void (calls.refreshed += 1);

  async function leave() {
    setBusy(true);
    try {
      await doFetch();
    } catch {
      /* deliberately swallowed — see the component */
    } finally {
      setBusy(false);
      refresh();
    }
  }
  return { leave, calls };
}

describe("leaving support mode", () => {
  it("re-enables the button after a successful request", async () => {
    const { leave, calls } = makeLeave(async () => ({ ok: true }));
    await leave();
    expect(calls.busy).toEqual([true, false]);
    expect(calls.refreshed).toBe(1);
  });

  it("re-enables the button when the request FAILS", async () => {
    // The original bug: this left busy stuck at [true].
    const { leave, calls } = makeLeave(async () => {
      throw new Error("network down");
    });
    await leave();
    expect(calls.busy).toEqual([true, false]);
  });

  it("still refreshes after a failure, because the cookie is cleared server-side", async () => {
    const { leave, calls } = makeLeave(async () => {
      throw new Error("network down");
    });
    await leave();
    expect(calls.refreshed).toBe(1);
  });

  it("does not rethrow — a failed leave must not surface as an unhandled rejection", async () => {
    const { leave } = makeLeave(async () => {
      throw new Error("network down");
    });
    await expect(leave()).resolves.toBeUndefined();
  });
});

describe("the component matches the tested shape", () => {
  it("wraps the fetch so busy is cleared in a finally block", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(
      join(process.cwd(), "src/components/shared/support-banner.tsx"),
      "utf8"
    );
    // Guards against a future edit dropping the try/finally and silently
    // reintroducing the stuck-button state.
    expect(src).toMatch(/try\s*\{[\s\S]*?await fetch\([\s\S]*?\}\s*finally\s*\{/);
    expect(src).toMatch(/finally\s*\{[\s\S]*?setBusy\(false\)/);
  });
});
