import type { FieldDescriptor, SlideIssue } from "@repo/slides";

export type Path = (string | number)[];

export function pathKey(path: Path): string {
  return path.join(".");
}

export function getAt(obj: unknown, path: Path): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** Immutable set; `undefined` removes the key (used for optional groups). */
export function setAt<T>(obj: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const container: Record<string | number, unknown> | unknown[] =
    Array.isArray(obj) ? [...obj]
    : obj !== null && typeof obj === "object" ? { ...(obj as Record<string, unknown>) }
    : typeof head === "number" ? [] : {};
  const child = (container as Record<string | number, unknown>)[head];
  const nextChild = rest.length === 0 ? value : setAt(child, rest, value);
  if (nextChild === undefined && !Array.isArray(container)) {
    delete (container as Record<string, unknown>)[head];
  } else {
    (container as Record<string | number, unknown>)[head] = nextChild;
  }
  return container as T;
}

export function issuesByPath(issues: SlideIssue[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    if (!(issue.path in result)) result[issue.path] = issue.message;
  }
  return result;
}

export function emptyValueFor(field: FieldDescriptor): unknown {
  switch (field.kind) {
    case "boolean":
      return false;
    case "select":
      return field.options?.[0]?.value ?? "";
    case "image":
      return { url: "", alt: "" };
    case "list":
    case "objectList":
      return [];
    case "group":
      return Object.fromEntries((field.fields ?? []).map((f) => [f.name, emptyValueFor(f)]));
    default:
      return "";
  }
}

/** Fields whose descriptor kind is "text" but whose stored value is a number array. */
export const LINE_LIST_FIELDS: ReadonlySet<string> = new Set(["highlightLines"]);

/**
 * "2, 4-5" -> [2, 4, 5]. Empty input -> undefined (drops the optional key).
 * Unparseable input is returned as-is so the slide schema reports it.
 */
export function parseLineList(text: string): number[] | string | undefined {
  const tokens = text.split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return undefined;
  const lines: number[] = [];
  for (const token of tokens) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > to || to - from > 1000) return text;
      for (let n = from; n <= to; n++) lines.push(n);
    } else if (/^\d+$/.test(token)) {
      lines.push(Number(token));
    } else {
      return text;
    }
  }
  return lines;
}

export function formatLineList(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
}

/** The issue at `key`, else the first one nested under it (`key.0`, `key.1.title`...). */
export function firstIssueUnder(issues: Record<string, string>, key: string): string | undefined {
  if (key in issues) return issues[key];
  const prefix = `${key}.`;
  const nested = Object.keys(issues).find((k) => k.startsWith(prefix));
  return nested === undefined ? undefined : issues[nested];
}
