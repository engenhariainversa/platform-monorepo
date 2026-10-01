import { z } from "zod";
import { imageRef, obj, optionalText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const imageSchema = obj({
  image: imageRef,
  caption: optionalText(160),
  fit: z.enum(["cover", "contain"]).default("contain"),
});

export const image = {
  key: "image",
  label: "Imagem cheia",
  description: "Uma imagem ocupando o slide, com legenda opcional.",
  schema: imageSchema,
  defaults: { image: { url: "/uploads/placeholder.png", alt: "" }, fit: "contain" },
  example: {
    image: { url: "https://engenhariainversa.com.br/images/live-studio.png", alt: "Estúdio da live" },
    caption: "Bastidores da live #12",
    fit: "cover",
  },
  fields: [
    { name: "image", label: "Imagem", kind: "image" },
    { name: "caption", label: "Legenda", kind: "text", optional: true, maxLength: 160 },
    {
      name: "fit",
      label: "Enquadramento",
      kind: "select",
      options: [
        { value: "contain", label: "Mostrar inteira" },
        { value: "cover", label: "Preencher o slide" },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof imageSchema, "image">;
