import { describe, expect, it } from "vitest";
import {
  INITIAL_FOLLOW_STATE,
  followReducer,
  followTargetIndex,
  needsDeckRefresh,
  showFollowButton,
  type FollowAction,
} from "./follow";

const run = (...actions: FollowAction[]) => actions.reduce(followReducer, INITIAL_FOLLOW_STATE);

describe("followReducer", () => {
  it("follows by default and shows no button when nothing is live", () => {
    const state = run({ type: "viewer", slideId: "s1" });
    expect(state.following).toBe(true);
    expect(showFollowButton(state)).toBe(false);
  });

  it("keeps following when the page's first slide differs from the presenter's (deep link while live)", () => {
    const state = run({ type: "presenter", slideId: "s4" }, { type: "viewer", slideId: "s1" });
    expect(state.following).toBe(true);
    expect(showFollowButton(state)).toBe(true); // until the player jumps
    const jumped = followReducer(state, { type: "viewer", slideId: "s4" });
    expect(jumped.following).toBe(true);
    expect(showFollowButton(jumped)).toBe(false);
  });

  it("enters free mode when the viewer navigates away, showing the button", () => {
    const state = run(
      { type: "viewer", slideId: "s1" },
      { type: "presenter", slideId: "s1" },
      { type: "viewer", slideId: "s2" },
    );
    expect(state.following).toBe(false);
    expect(showFollowButton(state)).toBe(true);
  });

  it("stays in free mode while the presenter moves, button visible exactly when the slides differ", () => {
    let state = run(
      { type: "viewer", slideId: "s1" },
      { type: "presenter", slideId: "s1" },
      { type: "viewer", slideId: "s3" },
    );
    state = followReducer(state, { type: "presenter", slideId: "s2" });
    expect(state.following).toBe(false);
    expect(showFollowButton(state)).toBe(true);
    state = followReducer(state, { type: "presenter", slideId: "s3" }); // presenter lands on the viewer's slide
    expect(showFollowButton(state)).toBe(false);
  });

  it("resumes following on the button, and when the viewer walks back onto the presenter's slide", () => {
    const free = run(
      { type: "viewer", slideId: "s1" },
      { type: "presenter", slideId: "s1" },
      { type: "viewer", slideId: "s2" },
    );
    expect(followReducer(free, { type: "follow" }).following).toBe(true);
    expect(followReducer(free, { type: "viewer", slideId: "s1" }).following).toBe(true);
  });

  it("goes back to following-by-default when the session ends", () => {
    const state = run(
      { type: "viewer", slideId: "s1" },
      { type: "presenter", slideId: "s1" },
      { type: "viewer", slideId: "s2" },
      { type: "presenter", slideId: null },
    );
    expect(state).toMatchObject({ following: true, presenterSlideId: null });
    expect(showFollowButton(state)).toBe(false);
  });
});

describe("followTargetIndex", () => {
  it("finds the slide to jump to", () => {
    expect(followTargetIndex(["a", "b", "c"], "c")).toBe(2);
  });
  it("returns null (stay put) for an unknown slide or when not following", () => {
    expect(followTargetIndex(["a", "b"], "zzz")).toBeNull();
    expect(followTargetIndex(["a", "b"], null)).toBeNull();
    expect(followTargetIndex([], "a")).toBeNull();
  });
});

describe("needsDeckRefresh", () => {
  it("asks for a refresh when the presenter is on a slide this page does not have", () => {
    expect(needsDeckRefresh("new-slide", ["a", "b"])).toBe(true);
    expect(needsDeckRefresh("a", ["a", "b"])).toBe(false);
    expect(needsDeckRefresh(null, ["a", "b"])).toBe(false);
  });
});
