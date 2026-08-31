import { Injectable } from "@nestjs/common";
import { prisma } from "@repo/database";

@Injectable()
export class StatsService {
  async getDashboardStats() {
    const [users, episodes, lives] = await prisma.$transaction([
      prisma.user.count(),
      prisma.episode.count(),
      prisma.live.count(),
    ]);

    return { users, episodes, lives };
  }
}
