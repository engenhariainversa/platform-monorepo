import { describe, expect, it } from "vitest";
import { extractPresenterToken } from "./presenter-token";

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
