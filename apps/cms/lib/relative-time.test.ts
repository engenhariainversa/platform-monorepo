import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("relativeTime", () => {
  it("describes future instants", () => {
    expect(relativeTime(at(23 * HOUR), NOW)).toBe("em 23 horas");
    expect(relativeTime(at(5 * DAY), NOW)).toBe("em 5 dias");
    expect(relativeTime(at(10 * MIN), NOW)).toBe("em 10 minutos");
  });

  it("describes past instants", () => {
    expect(relativeTime(at(-5 * MIN), NOW)).toBe("há 5 minutos");
    expect(relativeTime(at(-3 * HOUR), NOW)).toBe("há 3 horas");
  });

  it("says agora for the current instant", () => {
    expect(relativeTime(at(0), NOW)).toBe("agora");
  });
});
