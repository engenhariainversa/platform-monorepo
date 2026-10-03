import { Prism } from "prism-react-renderer";

// prismjs language components register themselves on a global `Prism`.
// This module must be imported before any of them (see prism-languages.ts).
(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism;
