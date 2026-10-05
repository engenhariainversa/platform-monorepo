import { z } from "zod";
import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const agendaSchema = obj({
  title: requiredText(80).default("Agenda"),
  steps: z
    .array(obj({ title: requiredText(60), description: optionalText(120) }), {
      error: "Esperada uma lista",
    })
    .min(2, { error: "Mínimo de 2 itens" })
    .max(7, { error: "Máximo de 7 itens" }),
});

export const agenda = {
  key: "agenda",
  label: "Introdução / Agenda",
  description: "Roteiro da apresentação, desenhado como um pipeline numerado.",
  schema: agendaSchema,
  defaults: {
    title: "Agenda",
    steps: [{ title: "Contexto" }, { title: "Mão na massa" }, { title: "Próximos passos" }],
  },
  example: {
    title: "O que vamos ver",
    steps: [
      { title: "Montando o ambiente", description: "Emulador, proxy e certificado" },
      { title: "Interceptando o tráfego", description: "Lendo as chamadas do app" },
      { title: "Contornando o pinning", description: "Frida na prática" },
      { title: "Conclusões" },
    ],
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    {
      name: "steps",
      label: "Etapas",
      kind: "objectList",
      minItems: 2,
      maxItems: 7,
      fields: [
        { name: "title", label: "Etapa", kind: "text", maxLength: 60 },
        { name: "description", label: "Descrição", kind: "text", optional: true, maxLength: 120 },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof agendaSchema, "agenda">;
