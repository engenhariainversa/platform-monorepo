import { describe, expect, it } from "vitest";
import { SLIDE_TEMPLATES, type FieldDescriptor } from "@repo/slides";
import { emptyValueFor, firstIssueUnder, formatLineList, getAt, issuesByPath, parseLineList, pathKey, setAt } from "./form-state";

describe("pathKey", () => {
  it("joins with dots", () => {
    expect(pathKey(["steps", 2, "title"])).toBe("steps.2.title");
    expect(pathKey([])).toBe("");
  });
});

describe("getAt / setAt", () => {
  const value = { title: "A", steps: [{ title: "x" }, { title: "y" }] };

  it("reads nested values", () => {
    expect(getAt(value, ["steps", 1, "title"])).toBe("y");
    expect(getAt(value, ["missing", 0])).toBeUndefined();
  });

  it("writes immutably", () => {
    const next = setAt(value, ["steps", 1, "title"], "z");
    expect(getAt(next, ["steps", 1, "title"])).toBe("z");
    expect(value.steps[1].title).toBe("y");
    expect(next.steps[0]).toBe(value.steps[0]);
  });

  it("creates missing containers, arrays for numeric keys", () => {
    expect(setAt({}, ["cta", "text"], "Ver")).toEqual({ cta: { text: "Ver" } });
    expect(setAt({}, ["items", 0], "a")).toEqual({ items: ["a"] });
  });

  it("deletes the key when the value is undefined", () => {
    expect(setAt({ cta: { text: "a", url: "#" }, title: "t" }, ["cta"], undefined)).toEqual({ title: "t" });
  });
});

describe("issuesByPath", () => {
  it("keeps the first message per path", () => {
    expect(
      issuesByPath([
        { path: "title", message: "Obrigatório" },
        { path: "title", message: "Outro" },
        { path: "steps.0.title", message: "Máximo de 60 caracteres" },
      ]),
    ).toEqual({ title: "Obrigatório", "steps.0.title": "Máximo de 60 caracteres" });
  });
});

describe("emptyValueFor", () => {
  it("returns a sensible blank per kind", () => {
    const f = (field: Partial<FieldDescriptor>) => ({ name: "x", label: "X", kind: "text", ...field }) as FieldDescriptor;
    expect(emptyValueFor(f({ kind: "text" }))).toBe("");
    expect(emptyValueFor(f({ kind: "boolean" }))).toBe(false);
    expect(emptyValueFor(f({ kind: "select", options: [{ value: "left", label: "Esquerda" }] }))).toBe("left");
    expect(emptyValueFor(f({ kind: "image" }))).toEqual({ url: "", alt: "" });
    expect(emptyValueFor(f({ kind: "list" }))).toEqual([]);
    expect(
      emptyValueFor(f({ kind: "group", fields: [f({ name: "label" }), f({ name: "items", kind: "list" })] })),
    ).toEqual({ label: "", items: [] });
  });
});

describe("parseLineList / formatLineList", () => {
  it("parses comma lists and ranges into numbers", () => {
    expect(parseLineList("2, 4-5")).toEqual([2, 4, 5]);
    expect(parseLineList("2,4")).toEqual([2, 4]);
    expect(parseLineList("3-3, 1")).toEqual([3, 1]);
  });

  it("returns undefined when empty so the optional key is dropped", () => {
    expect(parseLineList("")).toBeUndefined();
    expect(parseLineList(" , ")).toBeUndefined();
  });

  it("keeps unparseable input as the raw string so the schema reports it", () => {
    expect(parseLineList("2, abc")).toBe("2, abc");
    expect(parseLineList("5-2")).toBe("5-2");
  });

  it("formats an existing array back to text", () => {
    expect(formatLineList([2, 4])).toBe("2, 4");
    expect(formatLineList(undefined)).toBe("");
    expect(formatLineList("2, abc")).toBe("2, abc");
  });

  it("round-trips into a value the code schema accepts", () => {
    const parsed = parseLineList("2, 4-5") as number[];
    const result = SLIDE_TEMPLATES.code.schema.safeParse({ code: "a\nb\nc\nd\ne", language: "ts", highlightLines: parsed });
    expect(result.success).toBe(true);
  });
});

describe("firstIssueUnder", () => {
  it("prefers the exact key, then the first nested one", () => {
    expect(firstIssueUnder({ highlightLines: "A", "highlightLines.0": "B" }, "highlightLines")).toBe("A");
    expect(firstIssueUnder({ "highlightLines.0": "Mínimo 1" }, "highlightLines")).toBe("Mínimo 1");
    expect(firstIssueUnder({ highlightLinesX: "no", title: "t" }, "highlightLines")).toBeUndefined();
  });

  it("surfaces the schema's per-line issue for highlightLines", () => {
    const result = SLIDE_TEMPLATES.code.schema.safeParse({ code: "a", language: "ts", highlightLines: [0] });
    expect(result.success).toBe(false);
    const issues: Record<string, string> = {};
    if (!result.success) for (const i of result.error.issues) issues[i.path.join(".")] ??= i.message;
    expect(issues["highlightLines.0"]).toBeDefined();
    expect(firstIssueUnder(issues, "highlightLines")).toBe(issues["highlightLines.0"]);
  });
});
