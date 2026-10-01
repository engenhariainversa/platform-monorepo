import { z } from "zod";
import { linkUrl, obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const closingSchema = obj({
  title: requiredText(80).default("Obrigado!"),
  message: optionalText(240),
  cta: obj({ text: requiredText(40), url: linkUrl }).optional(),
  showSocialLinks: z.boolean().default(true),
});

export const closing = {
  key: "closing",
  label: "Encerramento",
  description: "Fechamento com mensagem, chamada para ação e os links sociais do rodapé.",
  schema: closingSchema,
  defaults: { title: "Obrigado!", showSocialLinks: true },
  example: {
    title: "Valeu, pessoal!",
    message: "Os links e o código desta live estão na descrição.",
    cta: { text: "Acompanhar no YouTube", url: "https://youtube.com/@engenhariainversa" },
    showSocialLinks: true,
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "message", label: "Mensagem", kind: "textarea", optional: true, maxLength: 240 },
    {
      name: "cta",
      label: "Chamada para ação",
      kind: "group",
      optional: true,
      fields: [
        { name: "text", label: "Texto do botão", kind: "text", maxLength: 40 },
        { name: "url", label: "Link", kind: "text" },
      ],
    },
    { name: "showSocialLinks", label: "Mostrar links sociais do rodapé", kind: "boolean" },
  ],
} satisfies SlideTemplateDefinition<typeof closingSchema, "closing">;
