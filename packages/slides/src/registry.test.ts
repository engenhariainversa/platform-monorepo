import { describe, expect, it } from "vitest";
import {
  SLIDE_TEMPLATES,
  SLIDE_TEMPLATE_KEYS,
  isSlideTemplateKey,
  parseSlideContent,
  slideTemplateJsonSchema,
} from "./index";

describe("registry", () => {
  it("has one definition per key, with matching key", () => {
    for (const key of SLIDE_TEMPLATE_KEYS) {
      expect(SLIDE_TEMPLATES[key].key).toBe(key);
    }
  });

  it.each(SLIDE_TEMPLATE_KEYS)("%s accepts its example and its defaults", (key) => {
    const def = SLIDE_TEMPLATES[key];
    expect(parseSlideContent(key, def.example)).toMatchObject({ ok: true });
    expect(parseSlideContent(key, def.defaults)).toMatchObject({ ok: true });
  });

  it.each(SLIDE_TEMPLATE_KEYS)("%s declares a field for every schema key", (key) => {
    const def = SLIDE_TEMPLATES[key];
    const shapeKeys = Object.keys((def.schema as unknown as { shape: object }).shape).sort();
    expect(def.fields.map((f) => f.name).sort()).toEqual(shapeKeys);
  });

  it.each(SLIDE_TEMPLATE_KEYS)("%s produces an object JSON Schema", (key) => {
    const schema = slideTemplateJsonSchema(key);
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeTypeOf("object");
  });

  it("knows its keys", () => {
    expect(isSlideTemplateKey("cover")).toBe(true);
    expect(isSlideTemplateKey("hero")).toBe(false);
  });
});

describe("parseSlideContent", () => {
  it("rejects an unknown template at path 'template'", () => {
    expect(parseSlideContent("hero", {})).toEqual({
      ok: false,
      issues: [{ path: "template", message: "Modelo desconhecido: hero" }],
    });
  });

  it("trims strings and applies defaults", () => {
    const result = parseSlideContent("cover", { title: "  Olá  " });
    expect(result).toEqual({
      ok: true,
      template: "cover",
      data: { title: "Olá", showMascot: true },
    });
  });

  it("reports a missing required field by path", () => {
    const result = parseSlideContent("cover", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: "title", message: "Obrigatório" });
  });

  it("reports an over-limit string with the limit", () => {
    const result = parseSlideContent("cover", { title: "x".repeat(91) });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues).toContainEqual({ path: "title", message: "Máximo de 90 caracteres" });
  });

  it("reports nested paths inside lists", () => {
    const result = parseSlideContent("agenda", {
      title: "Agenda",
      steps: [{ title: "Um" }, { title: "" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: "steps.1.title", message: "Obrigatório" });
  });

  it("rejects lists above the maximum", () => {
    const result = parseSlideContent("bullets", { title: "T", items: Array(7).fill("item") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: "items", message: "Máximo de 6 itens" });
  });

  it("rejects unknown fields so typos surface", () => {
    const result = parseSlideContent("section", { title: "T", tagLine: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues).toContainEqual({ path: "", message: "Campo desconhecido: tagLine" });
  });

  it("rejects non-object content at the root", () => {
    const result = parseSlideContent("section", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].path).toBe("");
  });
});
