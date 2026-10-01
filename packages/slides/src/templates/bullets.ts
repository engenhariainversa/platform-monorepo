import { obj, requiredText, textList } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const bulletsSchema = obj({
  title: requiredText(80),
  items: textList(1, 6, 140),
});

export const bullets = {
  key: "bullets",
  label: "Tópicos",
  description: "Título e até 6 tópicos curtos.",
  schema: bulletsSchema,
  defaults: { title: "Tópicos", items: ["Primeiro ponto", "Segundo ponto", "Terceiro ponto"] },
  example: {
    title: "Por que o app confia no certificado",
    items: [
      "O Android só confia nas CAs do sistema por padrão",
      "O app pode fixar o certificado (pinning)",
      "Network Security Config decide o que vale",
    ],
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "items", label: "Tópicos", kind: "list", minItems: 1, maxItems: 6, maxLength: 140 },
  ],
} satisfies SlideTemplateDefinition<typeof bulletsSchema, "bullets">;
