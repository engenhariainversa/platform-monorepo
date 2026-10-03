import { SLIDE_TEMPLATES } from "@repo/slides";

const COVER_TITLE_MAX = 90;

/** The deck a new presentation starts with: Capa + Agenda + Encerramento. */
export function starterSlides(title: string) {
  return [
    {
      template: "cover",
      content: { ...SLIDE_TEMPLATES.cover.defaults, title: title.trim().slice(0, COVER_TITLE_MAX) },
    },
    { template: "agenda", content: { ...SLIDE_TEMPLATES.agenda.defaults } },
    { template: "closing", content: { ...SLIDE_TEMPLATES.closing.defaults } },
  ] as { template: string; content: Record<string, unknown> }[];
}
