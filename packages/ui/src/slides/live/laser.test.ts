import { describe, expect, it } from "vitest";
import { normalizedPoint } from "./laser";

const rect = { left: 100, top: 50, width: 800, height: 450 };

describe("normalizedPoint", () => {
  it("maps a mouse position to 0..1 on the canvas, whatever its on-screen scale", () => {
    expect(normalizedPoint(rect, 500, 275)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizedPoint(rect, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(normalizedPoint(rect, 900, 500)).toEqual({ x: 1, y: 1 });
  });
  it("clamps positions outside the canvas and survives a zero-sized rect", () => {
    expect(normalizedPoint(rect, 0, 9999)).toEqual({ x: 0, y: 1 });
    expect(normalizedPoint({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({ x: 0, y: 0 });
  });
});
