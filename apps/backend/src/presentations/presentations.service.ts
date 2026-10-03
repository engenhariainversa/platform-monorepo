import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma, prisma, type Presentation, type Slide } from "@repo/database";
import { isValidSlug, slugify, type PresentationVisibility } from "@repo/slides";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { badInput, inTrash, invalidSlug, notFound, slugTaken } from "./presentation-errors";
import { validateSlides, type SlideInputData } from "./slide-validation";

export type SlideView = Omit<Slide, "notes"> & { notes: string | null };
export type PresentationWithSlides = Presentation & { slides: SlideView[] };
/** null = anonymous. `canRead` = the user's role has presentations:read. */
export type Viewer = { user: AuthenticatedUser; canRead: boolean } | null;

export interface CreatePresentationData {
  title: string;
  slug?: string | null;
  description?: string | null;
  visibility?: PresentationVisibility | null;
  slides?: SlideInputData[] | null;
}

export interface UpdatePresentationData {
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  visibility?: PresentationVisibility | null;
}

const WITH_SLIDES = { slides: { orderBy: { order: "asc" as const } } };
const MAX_TITLE = 120;

/** What an anonymous reader may see: no speaker notes, no hidden slides. */
export function toAnonymousView(p: PresentationWithSlides): PresentationWithSlides {
  return { ...p, slides: p.slides.filter((s) => !s.hidden).map((s) => ({ ...s, notes: null })) };
}

export async function assertWritable(presentationId: string): Promise<Presentation> {
  const p = await prisma.presentation.findUnique({ where: { id: presentationId } });
  if (!p) throw notFound("Apresentação não encontrada");
  if (p.deletedAt) throw inTrash();
  return p;
}

function cleanTitle(title: string): string {
  const t = title.trim();
  if (!t) throw badInput("Título obrigatório");
  if (t.length > MAX_TITLE) throw badInput(`Título com no máximo ${MAX_TITLE} caracteres`);
  return t;
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

@Injectable()
export class PresentationsService {
  list(trash: boolean): Promise<PresentationWithSlides[]> {
    return prisma.presentation.findMany({
      where: { deletedAt: trash ? { not: null } : null },
      include: WITH_SLIDES,
      orderBy: { updatedAt: "desc" },
    });
  }

  getById(id: string): Promise<PresentationWithSlides | null> {
    return prisma.presentation.findUnique({ where: { id }, include: WITH_SLIDES });
  }

  async getBySlug(slug: string, viewer: Viewer): Promise<PresentationWithSlides | null> {
    const p = await prisma.presentation.findUnique({ where: { slug }, include: WITH_SLIDES });
    if (!p) return null;
    if (viewer?.canRead) return p;
    if (p.visibility !== "PUBLIC" || p.deletedAt) {
      throw new UnauthorizedException("Apresentação privada");
    }
    return toAnonymousView(p);
  }

  async create(input: CreatePresentationData, userId: string): Promise<PresentationWithSlides> {
    const title = cleanTitle(input.title);
    const slides = validateSlides(input.slides ?? []);
    const slug = await this.resolveSlug(input.slug, title);
    try {
      return await prisma.presentation.create({
        data: {
          title,
          slug,
          description: input.description?.trim() || null,
          visibility: input.visibility ?? "PRIVATE",
          createdById: userId,
          slides: {
            create: slides.map((s, order) => ({
              order,
              template: s.template,
              content: s.content as Prisma.InputJsonValue,
              notes: s.notes,
              hidden: s.hidden,
            })),
          },
        },
        include: WITH_SLIDES,
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw slugTaken(slug);
      throw e;
    }
  }

  async update(id: string, input: UpdatePresentationData): Promise<PresentationWithSlides> {
    const current = await assertWritable(id);
    const data: Prisma.PresentationUpdateInput = {};
    if (input.title != null) data.title = cleanTitle(input.title);
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.visibility != null) data.visibility = input.visibility;
    if (input.slug != null && input.slug !== current.slug) {
      if (!isValidSlug(input.slug)) throw invalidSlug(input.slug);
      data.slug = input.slug;
    }
    try {
      return await prisma.presentation.update({ where: { id }, data, include: WITH_SLIDES });
    } catch (e) {
      if (isUniqueViolation(e)) throw slugTaken(input.slug as string);
      throw e;
    }
  }

  async duplicate(id: string, userId: string): Promise<PresentationWithSlides> {
    await assertWritable(id);
    const source = (await this.getById(id)) as PresentationWithSlides;
    const title = `${source.title} (cópia)`.slice(0, MAX_TITLE);
    return this.create(
      {
        title,
        description: source.description,
        visibility: "PRIVATE",
        slides: source.slides.map((s) => ({
          template: s.template,
          content: s.content,
          notes: s.notes,
          hidden: s.hidden,
        })),
      },
      userId,
    );
  }

  async softDelete(id: string): Promise<boolean> {
    const p = await prisma.presentation.findUnique({ where: { id } });
    if (!p) throw notFound("Apresentação não encontrada");
    if (!p.deletedAt) await prisma.presentation.update({ where: { id }, data: { deletedAt: new Date() } });
    return true;
  }

  async restore(id: string): Promise<PresentationWithSlides> {
    const p = await prisma.presentation.findUnique({ where: { id } });
    if (!p) throw notFound("Apresentação não encontrada");
    return prisma.presentation.update({ where: { id }, data: { deletedAt: null }, include: WITH_SLIDES });
  }

  async purge(id: string): Promise<boolean> {
    const p = await prisma.presentation.findUnique({ where: { id } });
    if (!p) throw notFound("Apresentação não encontrada");
    if (!p.deletedAt) throw badInput("Mova para a lixeira antes de excluir definitivamente");
    await prisma.presentation.delete({ where: { id } });
    return true;
  }

  async assertNotTrashed(id: string): Promise<void> {
    await assertWritable(id);
  }

  /** Explicit slugs must be valid and free; generated ones get -2, -3… */
  private async resolveSlug(explicit: string | null | undefined, title: string): Promise<string> {
    if (explicit) {
      if (!isValidSlug(explicit)) throw invalidSlug(explicit);
      const taken = await prisma.presentation.findUnique({ where: { slug: explicit } });
      if (taken) throw slugTaken(explicit);
      return explicit;
    }
    const base = slugify(title);
    const existing = await prisma.presentation.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const used = new Set(existing.map((e) => e.slug));
    if (!used.has(base)) return base;
    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`;
      if (!used.has(candidate)) return candidate;
    }
  }
}
