import { afterEach, describe, expect, it, vi } from "vitest";
import { PRESENTER_TOKEN_STORAGE_KEY, clearPresenterToken, extractPresenterToken } from "./presenter-token";

describe("extractPresenterToken", () => {
  it("reads the token from the URL fragment", () => {
    expect(extractPresenterToken("#t=eip_AbC-123_xyz")).toBe("eip_AbC-123_xyz");
  });
  it("ignores slide hashes and anything that is not a presenter token", () => {
    expect(extractPresenterToken("#7")).toBeNull();
    expect(extractPresenterToken("")).toBeNull();
    expect(extractPresenterToken("#t=ei_apikey")).toBeNull();
    expect(extractPresenterToken("#t=eip_bad token")).toBeNull();
  });
});

describe("clearPresenterToken", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("removes the stored token", () => {
    const removeItem = vi.fn();
    vi.stubGlobal("sessionStorage", { removeItem });
    clearPresenterToken();
    expect(removeItem).toHaveBeenCalledWith(PRESENTER_TOKEN_STORAGE_KEY);
  });
  it("does not throw when storage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(() => clearPresenterToken()).not.toThrow();
  });
});
