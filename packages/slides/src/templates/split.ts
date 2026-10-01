import { z } from "zod";
import { imageRef, obj, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const splitSchema = obj({
  title: requiredText(80),
  body: requiredText(600),
  image: imageRef,
  imageSide: z.enum(["left", "right"]).default("right"),
});

export const split = {
  key: "split",
  label: "Texto + imagem",
  description: "Título, texto corrido (linhas em branco separam parágrafos) e uma imagem ao lado.",
  schema: splitSchema,
  defaults: {
    title: "Título",
    body: "Escreva o texto aqui.",
    image: { url: "/uploads/placeholder.png", alt: "" },
    imageSide: "right",
  },
  example: {
    title: "O proxy no meio do caminho",
    body: "O mitmproxy recebe as chamadas do app e as repassa para a API.\n\nCom o certificado instalado, o tráfego HTTPS fica legível.",
    image: { url: "https://engenhariainversa.com.br/images/live-studio.png", alt: "Diagrama do proxy" },
    imageSide: "right",
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "body", label: "Texto", kind: "textarea", maxLength: 600, help: "Linhas em branco separam parágrafos" },
    { name: "image", label: "Imagem", kind: "image" },
    {
      name: "imageSide",
      label: "Lado da imagem",
      kind: "select",
      options: [
        { value: "left", label: "Esquerda" },
        { value: "right", label: "Direita" },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof splitSchema, "split">;
