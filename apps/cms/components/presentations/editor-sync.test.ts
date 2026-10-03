import { describe, expect, it } from "vitest";
import { SaveTracker, laterTimestamp, shouldApplySync, shouldShowBanner } from "./editor-sync";

describe("SaveTracker", () => {
  it("clears a slide once its latest save resolves", () => {
    const t = new SaveTracker();
    const seq = t.edit("a", true);
    expect(t.status(1, false)).toBe("saving");
    t.saved("a", seq);
    expect(t.pending.has("a")).toBe(false);
    expect(t.status(0, false)).toBe("saved");
  });

  it("keeps a slide pending when a valid edit arrives while its save is in flight", () => {
    const t = new SaveTracker();
    const first = t.edit("a", true);
    t.edit("a", true);
    t.saved("a", first);
    expect(t.pending.has("a")).toBe(true);
    expect(t.status(0, false)).toBe("saving");
  });

  it("keeps an invalid edit made during an in-flight save of the same slide", () => {
    const t = new SaveTracker();
    const first = t.edit("a", true);
    t.edit("a", false);
    t.saved("a", first);
    expect(t.pending.has("a")).toBe(true);
    expect(t.status(0, false)).toBe("invalid");
  });

  it("does not mask an invalid slide with another slide's successful save", () => {
    const t = new SaveTracker();
    t.edit("a", false);
    const b = t.edit("b", true);
    t.saved("b", b);
    expect(t.status(0, false)).toBe("invalid");
  });

  it("reports a failed save until the slide is edited again (the retry)", () => {
    const t = new SaveTracker();
    const a = t.edit("a", true);
    t.failedSave("a", a);
    const b = t.edit("b", true);
    t.saved("b", b);
    expect(t.status(0, false)).toBe("error");
    expect(t.pending.has("a")).toBe(true);
    const retry = t.edit("a", true);
    expect(t.status(1, false)).toBe("saving");
    t.saved("a", retry);
    expect(t.status(0, false)).toBe("saved");
  });

  it("ignores the failure of a save that a newer edit already superseded", () => {
    const t = new SaveTracker();
    const first = t.edit("a", true);
    t.edit("a", true);
    t.failedSave("a", first);
    expect(t.failed.has("a")).toBe(false);
  });

  it("orders error > invalid > saving > saved", () => {
    const t = new SaveTracker();
    t.edit("a", false);
    t.edit("b", true);
    expect(t.status(0, true)).toBe("error");
    expect(t.status(0, false)).toBe("invalid");
  });

  it("forgets a deleted slide entirely", () => {
    const t = new SaveTracker();
    const seq = t.edit("a", false);
    t.failedSave("a", seq);
    t.forget("a");
    expect(t.pending.has("a")).toBe(false);
    expect(t.status(0, false)).toBe("saved");
  });
});

describe("shouldApplySync", () => {
  it("ignores a response older than the last applied one", () => {
    expect(shouldApplySync({ seq: 1, lastApplied: 2, epochAtStart: 5, epochNow: 5 })).toBe(false);
  });
  it("ignores a response requested before another write started", () => {
    expect(shouldApplySync({ seq: 3, lastApplied: 2, epochAtStart: 5, epochNow: 6 })).toBe(false);
  });
  it("applies the newest response when no write started since", () => {
    expect(shouldApplySync({ seq: 3, lastApplied: 2, epochAtStart: 6, epochNow: 6 })).toBe(true);
  });
});

describe("laterTimestamp", () => {
  it("never moves backwards", () => {
    expect(laterTimestamp("2026-10-03T10:00:01.000Z", "2026-10-03T10:00:00.000Z")).toBe("2026-10-03T10:00:01.000Z");
    expect(laterTimestamp("2026-10-03T10:00:00.000Z", "2026-10-03T10:00:01.000Z")).toBe("2026-10-03T10:00:01.000Z");
    expect(laterTimestamp(null, "2026-10-03T10:00:00.000Z")).toBe("2026-10-03T10:00:00.000Z");
  });
});

describe("shouldShowBanner", () => {
  const base = {
    fresh: "2026-10-03T10:00:01.000Z",
    known: "2026-10-03T10:00:00.000Z",
    writesInFlightAtStart: 0,
    writesInFlightNow: 0,
    epochAtStart: 4,
    epochNow: 4,
  };
  it("shows when the server moved and this tab was idle", () => {
    expect(shouldShowBanner(base)).toBe(true);
  });
  it("stays hidden when nothing moved or the response is older", () => {
    expect(shouldShowBanner({ ...base, fresh: base.known })).toBe(false);
    expect(shouldShowBanner({ ...base, fresh: "2026-10-03T09:59:59.000Z" })).toBe(false);
  });
  it("stays hidden while this tab has a write in flight or started one meanwhile", () => {
    expect(shouldShowBanner({ ...base, writesInFlightAtStart: 1 })).toBe(false);
    expect(shouldShowBanner({ ...base, writesInFlightNow: 1 })).toBe(false);
    expect(shouldShowBanner({ ...base, epochNow: 5 })).toBe(false);
  });
  it("stays hidden before the first load", () => {
    expect(shouldShowBanner({ ...base, known: null })).toBe(false);
  });
});
