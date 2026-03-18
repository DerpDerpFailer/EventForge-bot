import { prisma } from '../database/prisma';
import logger from '../utils/logger';
import type { StatsEntry } from '../types';

/**
 * Service de statistiques de participation
 */
export class StatsService {
  /**
   * Incrémente les statistiques d'un utilisateur
   */
  static async incrementStat(
    guildId: string,
    userId: string,
    userName: string,
    field: 'attended' | 'maybe' | 'declined' | 'noShow'
  ): Promise<void> {
    await prisma.userStats.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: {
        guildId,
        userId,
        userName,
        [field]: 1,
      },
      update: {
        userName,
        [field]: { increment: 1 },
      },
    });
  }

  /**
   * Met à jour les stats pour tous les participants d'un événement terminé
   */
  static async updateStatsForEvent(
    eventId: string,
    guildId: string
  ): Promise<void> {
    const participants = await prisma.eventParticipant.findMany({
      where: { eventId },
    });

    for (const p of participants) {
      // Détermine la catégorie de l'option via le template
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          template: { include: { options: true } },
        },
      });

      const option = event?.template?.options.find(
        (o) => o.emoji === p.optionEmoji
      );

      let field: 'attended' | 'maybe' | 'declined' = 'attended';
      if (option) {
        switch (option.category) {
          case 'signup':
            field = 'attended';
            break;
          case 'maybe':
            field = 'maybe';
            break;
          case 'decline':
            field = 'declined';
            break;
        }
      }

      if (!p.isWaitlisted) {
        await this.incrementStat(guildId, p.userId, p.userName, field);
      }
    }

    logger.info(`Updated stats for event ${eventId} with ${participants.length} participants`);
  }

  /**
   * Récupère le top des participants d'une guild
   */
  static async getTopParticipants(
    guildId: string,
    limit = 10
  ): Promise<StatsEntry[]> {
    const stats = await prisma.userStats.findMany({
      where: { guildId },
      orderBy: { attended: 'desc' },
      take: limit,
    });

    return stats.map((s) => ({
      userId: s.userId,
      userName: s.userName,
      attended: s.attended,
      maybe: s.maybe,
      declined: s.declined,
      noShow: s.noShow,
    }));
  }

  /**
   * Récupère les statistiques d'un utilisateur spécifique
   */
  static async getUserStats(
    guildId: string,
    userId: string
  ): Promise<StatsEntry | null> {
    const stats = await prisma.userStats.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!stats) return null;

    return {
      userId: stats.userId,
      userName: stats.userName,
      attended: stats.attended,
      maybe: stats.maybe,
      declined: stats.declined,
      noShow: stats.noShow,
    };
  }

  /**
   * Récupère toutes les stats d'une guild (pour export CSV)
   */
  static async getAllStats(guildId: string): Promise<StatsEntry[]> {
    const stats = await prisma.userStats.findMany({
      where: { guildId },
      orderBy: { attended: 'desc' },
    });

    return stats.map((s) => ({
      userId: s.userId,
      userName: s.userName,
      attended: s.attended,
      maybe: s.maybe,
      declined: s.declined,
      noShow: s.noShow,
    }));
  }
}
