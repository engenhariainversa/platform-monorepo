export const PRESENTATION_VISIBILITIES = ["PUBLIC", "PRIVATE", "MEMBERS"] as const;
export type PresentationVisibility = (typeof PRESENTATION_VISIBILITIES)[number];
