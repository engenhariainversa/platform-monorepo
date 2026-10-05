import { z } from "zod";

/** Strict object: unknown keys are errors, so a typo in an agent's payload surfaces. */
export const obj = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject(shape, {
    error: (issue) =>
      issue.code === "unrecognized_keys"
        ? `Campo desconhecido: ${issue.keys.join(", ")}`
        : issue.code === "invalid_type"
          ? "Esperado um objeto"
          : undefined,
  });

export const requiredText = (max: number) =>
  z
    .string({ error: "Obrigatório" })
    .trim()
    .min(1, { error: "Obrigatório" })
    .max(max, { error: `Máximo de ${max} caracteres` });

export const optionalText = (max: number) =>
  z
    .string({ error: "Esperado um texto" })
    .trim()
    .max(max, { error: `Máximo de ${max} caracteres` })
    .optional();

export const textList = (minItems: number, maxItems: number, maxLength: number) =>
  z
    .array(requiredText(maxLength), { error: "Esperada uma lista" })
    .min(minItems, { error: `Mínimo de ${minItems} ${minItems === 1 ? "item" : "itens"}` })
    .max(maxItems, { error: `Máximo de ${maxItems} itens` });

const HTTP_URL = /^https?:\/\/\S+$/;
const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9._-]+$/;

/** An image: absolute http(s) URL or a file served by the backend's /uploads. */
export const assetUrl = z
  .string({ error: "Obrigatório" })
  .trim()
  .refine((v) => HTTP_URL.test(v) || UPLOAD_PATH.test(v), {
    error: "Use uma URL http(s) ou um caminho /uploads/…",
  });

/** A link target: like assetUrl, plus "#" for a placeholder. */
export const linkUrl = z
  .string({ error: "Obrigatório" })
  .trim()
  .refine((v) => v === "#" || HTTP_URL.test(v) || UPLOAD_PATH.test(v), {
    error: "Use uma URL http(s), um caminho /uploads/… ou #",
  });

export const imageRef = obj({
  url: assetUrl,
  alt: z.string().trim().max(140, { error: "Máximo de 140 caracteres" }).default(""),
});

export const CODE_LANGUAGES = [
  "ts", "js", "tsx", "kotlin", "swift", "dart", "bash", "json", "yaml", "sql", "diff",
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
