import { GraphQLError } from "graphql";
import type { SlideIssue } from "@repo/slides";

const error = (message: string, extensions: Record<string, unknown>) =>
  new GraphQLError(message, { extensions });

export const invalidSlideContent = (slideIndex: number, template: string, issues: SlideIssue[]) =>
  error("Conteúdo de slide inválido", { code: "INVALID_SLIDE_CONTENT", slideIndex, template, issues });

export const unknownTemplate = (slideIndex: number, template: string) =>
  error(`Modelo desconhecido: ${template}`, { code: "UNKNOWN_TEMPLATE", slideIndex, template });

export const slugTaken = (slug: string) => error(`Slug já em uso: ${slug}`, { code: "SLUG_TAKEN", slug });

export const invalidSlug = (slug: string) =>
  error("Slug inválido: use letras minúsculas, números e hífens (até 80 caracteres)", {
    code: "INVALID_SLUG",
    slug,
  });

export const inTrash = () => error("Apresentação na lixeira", { code: "BAD_USER_INPUT" });

export const badInput = (message: string) => error(message, { code: "BAD_USER_INPUT" });

export const notFound = (message: string) => error(message, { code: "NOT_FOUND" });
