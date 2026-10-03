import type { CodeLanguage } from "@repo/slides";
import "./prism-setup";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-dart";
import "prismjs/components/prism-diff";

/** Template language key → Prism grammar name. */
export const PRISM_LANGUAGE: Record<CodeLanguage, string> = {
  ts: "typescript",
  js: "javascript",
  tsx: "tsx",
  kotlin: "kotlin",
  swift: "swift",
  dart: "dart",
  bash: "bash",
  json: "json",
  yaml: "yaml",
  sql: "sql",
  diff: "diff",
};
