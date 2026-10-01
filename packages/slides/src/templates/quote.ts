import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const quoteSchema = obj({
  quote: requiredText(280),
  author: optionalText(80),
  role: optionalText(80),
});

export const quote = {
  key: "quote",
  label: "Citação",
  description: "Uma frase em destaque com autor e papel.",
  schema: quoteSchema,
  defaults: { quote: "Uma frase marcante." },
  example: {
    quote: "Talk is cheap. Show me the code.",
    author: "Linus Torvalds",
    role: "Criador do Linux",
  },
  fields: [
    { name: "quote", label: "Citação", kind: "textarea", maxLength: 280 },
    { name: "author", label: "Autor", kind: "text", optional: true, maxLength: 80 },
    { name: "role", label: "Papel", kind: "text", optional: true, maxLength: 80 },
  ],
} satisfies SlideTemplateDefinition<typeof quoteSchema, "quote">;
