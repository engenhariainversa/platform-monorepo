import { z } from "zod";
import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const statsSchema = obj({
  title: optionalText(80),
  items: z
    .array(obj({ value: requiredText(12), label: requiredText(40) }), { error: "Esperada uma lista" })
    .min(2, { error: "Mínimo de 2 itens" })
    .max(4, { error: "Máximo de 4 itens" }),
});

export const stats = {
  key: "stats",
  label: "Números",
  description: "De 2 a 4 números grandes com rótulo, como os cards da seção Sobre.",
  schema: statsSchema,
  defaults: {
    items: [
      { value: "100+", label: "Horas de live" },
      { value: "15k", label: "Devs ativos" },
    ],
  },
  example: {
    title: "O canal até aqui",
    items: [
      { value: "42", label: "Lives" },
      { value: "15k", label: "Inscritos" },
      { value: "8", label: "Apps desmontados" },
    ],
  },
  fields: [
    { name: "title", label: "Título", kind: "text", optional: true, maxLength: 80 },
    {
      name: "items",
      label: "Números",
      kind: "objectList",
      minItems: 2,
      maxItems: 4,
      fields: [
        { name: "value", label: "Valor", kind: "text", maxLength: 12 },
        { name: "label", label: "Rótulo", kind: "text", maxLength: 40 },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof statsSchema, "stats">;
