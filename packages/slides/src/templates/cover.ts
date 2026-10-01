import { z } from "zod";
import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const coverSchema = obj({
  label: optionalText(40),
  title: requiredText(90),
  subtitle: optionalText(200),
  date: optionalText(40),
  showMascot: z.boolean().default(true),
});

export const cover = {
  key: "cover",
  label: "Capa",
  description: "Abertura: rótulo, título, subtítulo e data, com o mascote à direita.",
  schema: coverSchema,
  defaults: {
    label: "LIVE",
    title: "Título da apresentação",
    subtitle: "Uma frase sobre o que vamos ver",
    showMascot: true,
  },
  example: {
    label: "LIVE #12",
    title: "Engenharia reversa de um app de banco",
    subtitle: "Do proxy ao certificado: como o app conversa com a API",
    date: "1 de outubro de 2026",
    showMascot: true,
  },
  fields: [
    { name: "label", label: "Rótulo", kind: "text", optional: true, maxLength: 40, help: "Ex.: LIVE #12" },
    { name: "title", label: "Título", kind: "text", maxLength: 90 },
    { name: "subtitle", label: "Subtítulo", kind: "textarea", optional: true, maxLength: 200 },
    { name: "date", label: "Data", kind: "text", optional: true, maxLength: 40 },
    { name: "showMascot", label: "Mostrar mascote", kind: "boolean" },
  ],
} satisfies SlideTemplateDefinition<typeof coverSchema, "cover">;
