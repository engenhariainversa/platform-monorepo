import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const sectionSchema = obj({
  number: optionalText(4),
  title: requiredText(80),
  tagline: optionalText(160),
});

export const section = {
  key: "section",
  label: "Divisor de seção",
  description: "Abre um bloco da apresentação com número, título e frase de apoio.",
  schema: sectionSchema,
  defaults: { number: "01", title: "Nova seção" },
  example: { number: "02", title: "Interceptando o tráfego", tagline: "Tudo que o app manda, a gente lê" },
  fields: [
    { name: "number", label: "Número", kind: "text", optional: true, maxLength: 4, help: "Ex.: 01" },
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "tagline", label: "Frase de apoio", kind: "text", optional: true, maxLength: 160 },
  ],
} satisfies SlideTemplateDefinition<typeof sectionSchema, "section">;
