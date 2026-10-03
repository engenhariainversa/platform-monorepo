import type { PrismTheme } from "prism-react-renderer";

// Built from the design tokens: orange (primary), yellow (secondary), blue
// (tertiary) on surface-container-lowest.
export const codeTheme: PrismTheme = {
  plain: { color: "#d1e4fb", backgroundColor: "#000f1e" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#a48c7d", fontStyle: "italic" } },
    { types: ["keyword", "boolean", "important", "atrule"], style: { color: "#ffb783" } },
    { types: ["string", "char", "attr-value", "inserted"], style: { color: "#ffdd74" } },
    { types: ["function", "class-name", "builtin"], style: { color: "#92ccff" } },
    { types: ["number", "constant", "symbol"], style: { color: "#eec209" } },
    { types: ["tag", "selector", "property", "attr-name"], style: { color: "#cce5ff" } },
    { types: ["operator", "punctuation"], style: { color: "#dcc1b1" } },
    { types: ["deleted"], style: { color: "#ffb4ab" } },
    { types: ["variable", "parameter"], style: { color: "#d1e4fb" } },
  ],
};
