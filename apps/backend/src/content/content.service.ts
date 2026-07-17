import { Injectable } from "@nestjs/common";
import { prisma } from "@repo/database";
import {
  UpsertLiveInput,
  CreateEpisodeInput,
  UpdateEpisodeInput,
  UpsertEpisodesButtonInput,
  UpsertHeroSectionInput,
  UpsertAboutSectionInput,
} from "./content.types";

@Injectable()
export class ContentService {
  // ── Live (singleton pattern) ──────────────────────

  async getLive() {
    const live = await prisma.live.findFirst();
    return live;
  }

  async upsertLive(input: UpsertLiveInput) {
    const existing = await prisma.live.findFirst();

    if (existing) {
      return prisma.live.update({
        where: { id: existing.id },
        data: input,
      });
    }

    return prisma.live.create({ data: input });
  }

  // ── Episodes ──────────────────────────────────────

  async getEpisodes() {
    return prisma.episode.findMany({
      orderBy: { order: "asc" },
    });
  }

  async getEpisode(id: string) {
    return prisma.episode.findUnique({ where: { id } });
  }

  async createEpisode(input: CreateEpisodeInput) {
    const count = await prisma.episode.count();
    if (count >= 4) {
      throw new Error("Máximo de 4 episódios permitidos");
    }

    return prisma.episode.create({
      data: {
        ...input,
        order: input.order ?? count,
      },
    });
  }

  async updateEpisode(id: string, input: UpdateEpisodeInput) {
    return prisma.episode.update({
      where: { id },
      data: input,
    });
  }

  async deleteEpisode(id: string) {
    await prisma.episode.delete({ where: { id } });
    return true;
  }

  async reorderEpisodes(ids: string[]) {
    const updates = ids.map((id, index) =>
      prisma.episode.update({
        where: { id },
        data: { order: index },
      }),
    );
    await prisma.$transaction(updates);
    return this.getEpisodes();
  }

  // ── Hero section (singleton pattern) ──────────────

  async getHeroSection() {
    return prisma.heroSection.findFirst();
  }

  async upsertHeroSection(input: UpsertHeroSectionInput) {
    const existing = await prisma.heroSection.findFirst();

    if (existing) {
      return prisma.heroSection.update({
        where: { id: existing.id },
        data: input,
      });
    }

    return prisma.heroSection.create({ data: input });
  }

  // ── About section (singleton pattern) ─────────────

  async getAboutSection() {
    return prisma.aboutSection.findFirst();
  }

  async upsertAboutSection(input: UpsertAboutSectionInput) {
    const existing = await prisma.aboutSection.findFirst();

    if (existing) {
      return prisma.aboutSection.update({
        where: { id: existing.id },
        data: input,
      });
    }

    return prisma.aboutSection.create({ data: input });
  }

  // ── Episodes button (singleton pattern) ───────────

  async getEpisodesButton() {
    return prisma.episodesButton.findFirst();
  }

  async upsertEpisodesButton(input: UpsertEpisodesButtonInput) {
    const existing = await prisma.episodesButton.findFirst();

    if (existing) {
      return prisma.episodesButton.update({
        where: { id: existing.id },
        data: input,
      });
    }

    return prisma.episodesButton.create({ data: input });
  }
}
