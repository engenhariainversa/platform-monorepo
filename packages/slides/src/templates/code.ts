import { z } from "zod";
import { CODE_LANGUAGES, obj, optionalText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

const MAX_LINES = 24;

export const codeSchema = obj({
  title: optionalText(80),
  language: z.enum(CODE_LANGUAGES, { error: `Use uma destas linguagens: ${CODE_LANGUAGES.join(", ")}` }),
  // Not trimmed: leading indentation is part of the code.
  code: z
    .string({ error: "Obrigatório" })
    .max(2000, { error: "Máximo de 2000 caracteres" })
    .refine((v) => v.trim().length > 0, { error: "Obrigatório" })
    .refine((v) => v.replace(/\n$/, "").split("\n").length <= MAX_LINES, {
      error: `Máximo de ${MAX_LINES} linhas`,
    }),
  highlightLines: z
    .array(z.int().min(1).max(MAX_LINES), { error: "Esperada uma lista de números de linha" })
    .max(MAX_LINES)
    .optional(),
  caption: optionalText(160),
});

export const code = {
  key: "code",
  label: "Código",
  description: "Trecho de código com destaque de sintaxe e linhas em evidência.",
  schema: codeSchema,
  defaults: { language: "ts", code: "console.log(\"Olá, Engenharia Inversa\");" },
  example: {
    title: "Desligando o pinning com Frida",
    language: "js",
    code: [
      "Java.perform(() => {",
      "  const Pinner = Java.use(\"okhttp3.CertificatePinner\");",
      "  Pinner.check.overload(\"java.lang.String\", \"java.util.List\")",
      "    .implementation = () => {};",
      "});",
    ].join("\n"),
    highlightLines: [4],
    caption: "Sobrescreve a checagem do OkHttp",
  },
  fields: [
    { name: "title", label: "Título", kind: "text", optional: true, maxLength: 80 },
    {
      name: "language",
      label: "Linguagem",
      kind: "select",
      options: CODE_LANGUAGES.map((l) => ({ value: l, label: l })),
    },
    { name: "code", label: "Código", kind: "code", maxLength: 2000, help: "Máximo de 24 linhas" },
    {
      name: "highlightLines",
      label: "Linhas em destaque",
      kind: "text",
      optional: true,
      help: "Números separados por vírgula, ex.: 2, 4",
    },
    { name: "caption", label: "Legenda", kind: "text", optional: true, maxLength: 160 },
  ],
} satisfies SlideTemplateDefinition<typeof codeSchema, "code">;
