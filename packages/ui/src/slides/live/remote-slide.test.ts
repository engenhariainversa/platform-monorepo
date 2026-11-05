import { describe, expect, it } from "vitest";
import { ECHO_WINDOW_MS, absorbEcho } from "./remote-slide";

describe("absorbEcho", () => {
  it("applies a slide change that came from another controller", () => {
    expect(absorbEcho("s5", [], 1000)).toEqual({ apply: true, sent: [] });
    const sent = [{ id: "s2", at: 900 }];
    expect(absorbEcho("s5", sent, 1000)).toEqual({ apply: true, sent });
  });

  it("does not yank the presenter back when the echo of an earlier press arrives late", () => {
    // → pressed twice: s2 at t=0, s3 at t=50. The echo of s2 arrives at t=120.
    const sent = [{ id: "s2", at: 0 }, { id: "s3", at: 50 }];
    const afterFirstEcho = absorbEcho("s2", sent, 120);
    expect(afterFirstEcho).toEqual({ apply: false, sent: [{ id: "s3", at: 50 }] });
    expect(absorbEcho("s3", afterFirstEcho.sent, 170)).toEqual({ apply: false, sent: [] });
  });

  it("absorbs each sent slide once: the same slide coming from the other controller afterwards applies", () => {
    const afterEcho = absorbEcho("s2", [{ id: "s2", at: 0 }], 100);
    expect(absorbEcho("s2", afterEcho.sent, 300).apply).toBe(true);
  });

  it("forgets sent slides after the echo window", () => {
    const sent = [{ id: "s2", at: 0 }];
    expect(absorbEcho("s2", sent, ECHO_WINDOW_MS + 1)).toEqual({ apply: true, sent: [] });
  });
});
