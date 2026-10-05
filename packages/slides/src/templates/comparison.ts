import { z } from "zod";
import { obj, requiredText, textList } from "../common";
import type { FieldDescriptor } from "../fields";
import type { SlideTemplateDefinition } from "../definition";

const column = obj({ label: requiredText(40), items: textList(1, 6, 120) });

export const comparisonSchema = obj({
  title: requiredText(80),
  left: column,
  right: column,
  highlight: z.enum(["left", "right", "none"]).default("none"),
});

const columnFields: FieldDescriptor[] = [
  { name: "label", label: "Rótulo", kind: "text", maxLength: 40 },
  { name: "items", label: "Itens", kind: "list", minItems: 1, maxItems: 6, maxLength: 120 },
];

export const comparison = {
  key: "comparison",
  label: "Comparação",
  description: "Duas colunas lado a lado (antes/depois, A vs B), com uma delas em destaque.",
  schema: comparisonSchema,
  defaults: {
    title: "Comparação",
    left: { label: "Antes", items: ["Item"] },
    right: { label: "Depois", items: ["Item"] },
    highlight: "none",
  },
  example: {
    title: "HTTP vs HTTPS com pinning",
    left: { label: "Sem pinning", items: ["Proxy lê tudo", "Basta instalar a CA"] },
    right: { label: "Com pinning", items: ["Conexão recusada", "Precisa de Frida/patch"] },
    highlight: "right",
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "left", label: "Coluna da esquerda", kind: "group", fields: columnFields },
    { name: "right", label: "Coluna da direita", kind: "group", fields: columnFields },
    {
      name: "highlight",
      label: "Destaque",
      kind: "select",
      options: [
        { value: "none", label: "Nenhum" },
        { value: "left", label: "Esquerda" },
        { value: "right", label: "Direita" },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof comparisonSchema, "comparison">;
