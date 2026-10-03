// Slide decks built from the @repo/slides templates. Mirrors the backend's
// Presentation/Slide GraphQL types; dates arrive as ISO strings.
export type PresentationVisibility = "PUBLIC" | "PRIVATE" | "MEMBERS";

export type Slide = {
  id: string;
  order: number;
  template: string;
  content: Record<string, unknown>;
  /** null when read anonymously */
  notes: string | null;
  hidden: boolean;
};

export type Presentation = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: PresentationVisibility;
  slideCount: number;
  slides: Slide[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SlideTemplateInfo = {
  key: string;
  label: string;
  description: string;
  jsonSchema: Record<string, unknown>;
  example: Record<string, unknown>;
};

export type ApiKeyExpiry = "ONE_HOUR" | "ONE_DAY" | "SEVEN_DAYS";

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
