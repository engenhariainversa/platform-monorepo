import { Injectable } from "@nestjs/common";
import { Prisma, prisma, type Slide } from "@repo/database";
import { isSlideTemplateKey, switchTemplate } from "@repo/slides";
import { badInput, notFound, unknownTemplate } from "./presentation-errors";
import { assertWritable } from "./presentations.service";
import { validateSlide, validateSlides, type SlideInputData } from "./slide-validation";

type Tx = Prisma.TransactionClient;

/** Serializes concurrent writes to one deck's slides (row lock on the presentation). */
async function lockDeck(tx: Tx, presentationId: string) {
  await tx.$queryRaw`SELECT id FROM presentations WHERE id = ${presentationId} FOR UPDATE`;
}

async function touch(tx: Tx, presentationId: string) {
  await tx.presentation.update({ where: { id: presentationId }, data: { updatedAt: new Date() } });
}

async function rewriteOrder(tx: Tx, ids: string[]) {
  await Promise.all(ids.map((id, order) => tx.slide.update({ where: { id }, data: { order } })));
}

const orderedIds = async (tx: Tx, presentationId: string) =>
  (
    await tx.slide.findMany({
      where: { presentationId },
      orderBy: { order: "asc" },
      select: { id: true },
    })
  ).map((s) => s.id);

@Injectable()
export class SlidesService {
  async replaceSlides(presentationId: string, slides: SlideInputData[]): Promise<void> {
    await assertWritable(presentationId);
    const valid = validateSlides(slides);
    await prisma.$transaction(async (tx) => {
      await lockDeck(tx, presentationId);
      await tx.slide.deleteMany({ where: { presentationId } });
      await tx.slide.createMany({
        data: valid.map((s, order) => ({
          presentationId,
          order,
          template: s.template,
          content: s.content as Prisma.InputJsonValue,
          notes: s.notes,
          hidden: s.hidden,
        })),
      });
      await touch(tx, presentationId);
    });
  }

  async createSlide(presentationId: string, input: SlideInputData, position?: number | null): Promise<Slide> {
    await assertWritable(presentationId);
    return prisma.$transaction(async (tx) => {
      await lockDeck(tx, presentationId);
      const ids = await orderedIds(tx, presentationId);
      const at = position == null ? ids.length : Math.max(0, Math.min(position, ids.length));
      const valid = validateSlide(input, at);
      const slide = await tx.slide.create({
        data: {
          presentationId,
          order: ids.length,
          template: valid.template,
          content: valid.content as Prisma.InputJsonValue,
          notes: valid.notes,
          hidden: valid.hidden,
        },
      });
      if (at !== ids.length) {
        ids.splice(at, 0, slide.id);
        await rewriteOrder(tx, ids);
      }
      await touch(tx, presentationId);
      return tx.slide.findUniqueOrThrow({ where: { id: slide.id } });
    });
  }

  async updateSlide(id: string, input: Partial<SlideInputData>): Promise<Slide> {
    const slide = await prisma.slide.findUnique({ where: { id } });
    if (!slide) throw notFound("Slide não encontrado");
    await assertWritable(slide.presentationId);

    const ids = await orderedIds(prisma as unknown as Tx, slide.presentationId);
    const index = ids.indexOf(id);
    const template = input.template ?? slide.template;
    let content: unknown = slide.content;
    if (input.content !== undefined) {
      content = input.content;
    } else if (input.template && input.template !== slide.template) {
      if (!isSlideTemplateKey(input.template)) throw unknownTemplate(index, input.template);
      content = switchTemplate(slide.content as Record<string, unknown>, input.template);
    }
    const valid = validateSlide(
      { template, content, notes: input.notes ?? slide.notes, hidden: input.hidden ?? slide.hidden },
      index,
    );

    return prisma.$transaction(async (tx) => {
      const updated = await tx.slide.update({
        where: { id },
        data: {
          template: valid.template,
          content: valid.content as Prisma.InputJsonValue,
          notes: valid.notes,
          hidden: valid.hidden,
        },
      });
      await touch(tx, slide.presentationId);
      return updated;
    });
  }

  async deleteSlide(id: string): Promise<boolean> {
    const slide = await prisma.slide.findUnique({ where: { id } });
    if (!slide) throw notFound("Slide não encontrado");
    await assertWritable(slide.presentationId);
    await prisma.$transaction(async (tx) => {
      await lockDeck(tx, slide.presentationId);
      await tx.slide.delete({ where: { id } });
      await rewriteOrder(tx, await orderedIds(tx, slide.presentationId));
      await touch(tx, slide.presentationId);
    });
    return true;
  }

  async reorderSlides(presentationId: string, ids: string[]): Promise<Slide[]> {
    await assertWritable(presentationId);
    return prisma.$transaction(async (tx) => {
      await lockDeck(tx, presentationId);
      const current = await orderedIds(tx, presentationId);
      const sameSet =
        ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
      if (!sameSet) throw badInput("A lista deve conter exatamente os slides da apresentação");
      await rewriteOrder(tx, ids);
      await touch(tx, presentationId);
      return tx.slide.findMany({ where: { presentationId }, orderBy: { order: "asc" } });
    });
  }
}
