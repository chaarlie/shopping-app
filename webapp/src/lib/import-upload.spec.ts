import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadChunks, uploadDelay } from "./import-upload";
afterEach(() => vi.useRealTimers());
describe("multipart import browser flow", () => {
  it("uses a single final part at five MB and two bounded parts at ten MB", () => {
    expect(uploadChunks(5_000_000, 5 * 1024 * 1024)).toEqual([
      { number: 1, start: 0, end: 5_000_000 },
    ]);
    expect(uploadChunks(10_000_000, 5 * 1024 * 1024)).toEqual([
      { number: 1, start: 0, end: 5 * 1024 * 1024 },
      { number: 2, start: 5 * 1024 * 1024, end: 10_000_000 },
    ]);
  });
  it("cancels polling immediately instead of leaving a timer running", async () => {
    vi.useFakeTimers();
    const abort = new AbortController();
    const pending = uploadDelay(abort.signal);
    abort.abort(new Error("cancelled"));
    await expect(pending).rejects.toThrow("cancelled");
    expect(vi.getTimerCount()).toBe(0);
  });
});
