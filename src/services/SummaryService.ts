import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { prisma } from '../database/prisma';
import { GuildConfigService } from './GuildConfigService';
import { StatsService } from './StatsService';
import { ParticipationService } from './ParticipationService';
import { tWithLocale } from '../locales';
import { formatDate, discordTimestamp } from '../utils/dateUtils';
import { EMBED_COLOR_COMPLETED } from '../config/constants';
import logger from '../utils/logger';
import type { Locale } from '../types';

/**
 * Service d'envoi des résumés post-événement
 */
export class SummaryService {
  /**
   * Génère et envoie le résumé d'un événement terminé
   */
  static async sendSummary(eventId: string, client: Client): Promise<void> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
        template: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
      },
    });

    if (!event) {
      logger.warn(`Cannot send summary: event ${eventId} not found`);
      return;
    }

    if (event.summarySent) {
      logger.info(`Summary already sent for event ${eventId}`);
      return;
    }

    const guildConfig = await GuildConfigService.getOrCreate(event.guildId);
    const locale = guildConfig.locale;

    // Met à jour les statistiques des participants
    await StatsService.updateStatsForEvent(eventId, event.guildId);

    // Cherche le channel de résumé
    const summaryChannelId = guildConfig.summaryChannelId || event.channelId;

    try {
      const guild = await client.guilds.fetch(event.guildId);
      const channel = await guild.channels.fetch(summaryChannelId) as TextChannel;

      if (!channel || !channel.isTextBased()) {
        logger.warn(`Summary channel ${summaryChannelId} not found or not text-based`);
        return;
      }

      const embed = await this.buildSummaryEmbed(event, locale, guildConfig.timezone);
      await channel.send({ embeds: [embed] });

      // Marque le résumé comme envoyé
      await prisma.event.update({
        where: { id: eventId },
        data: { summarySent: true },
      });

      logger.info(`Summary sent for event ${eventId} in channel ${summaryChannelId}`);
    } catch (error) {
      logger.error(`Failed to send summary for event ${eventId}`, { error });
    }
  }

  /**
   * Construit l'embed de résumé
   */
  private static async buildSummaryEmbed(
    event: {
      id: string;
      title: string;
      eventDate: Date;
      template: { options: Array<{ emoji: string; label: string; category: string; sortOrder: number }> } | null;
      participants: Array<{ userId: string; userName: string; optionEmoji: string; optionLabel: string; isWaitlisted: boolean }>;
    },
    locale: Locale,
    timezone: string
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle(tWithLocale(locale, 'summary.title', { title: event.title }))
      .setColor(EMBED_COLOR_COMPLETED)
      .setDescription(tWithLocale(locale, 'summary.date', {
        date: discordTimestamp(event.eventDate, 'F'),
      }))
      .setTimestamp();

    const activeParticipants = event.participants.filter((p) => !p.isWaitlisted);

    if (event.template) {
      // Groupe par catégorie
      const signups = activeParticipants.filter((p) => {
        const opt = event.template!.options.find((o) => o.emoji === p.optionEmoji);
        return opt?.category === 'signup';
      });

      const maybes = activeParticipants.filter((p) => {
        const opt = event.template!.options.find((o) => o.emoji === p.optionEmoji);
        return opt?.category === 'maybe';
      });

      const declined = activeParticipants.filter((p) => {
        const opt = event.template!.options.find((o) => o.emoji === p.optionEmoji);
        return opt?.category === 'decline';
      });

      // Participants confirmés
      if (signups.length > 0) {
        embed.addFields({
          name: tWithLocale(locale, 'summary.participants_title', { count: signups.length }),
          value: signups.map((p) => `${p.optionEmoji} ${p.userName}`).join('\n'),
        });
      }

      // Peut-être
      if (maybes.length > 0) {
        embed.addFields({
          name: tWithLocale(locale, 'summary.maybe_title', { count: maybes.length }),
          value: maybes.map((p) => `${p.optionEmoji} ${p.userName}`).join('\n'),
        });
      }

      // Refus
      if (declined.length > 0) {
        embed.addFields({
          name: tWithLocale(locale, 'summary.declined_title', { count: declined.length }),
          value: declined.map((p) => `${p.optionEmoji} ${p.userName}`).join('\n'),
        });
      }
    } else {
      // Pas de template, liste simple
      const value = activeParticipants.length > 0
        ? activeParticipants.map((p) => `${p.optionEmoji} ${p.userName}`).join('\n')
        : tWithLocale(locale, 'summary.no_participants');

      embed.addFields({
        name: tWithLocale(locale, 'summary.participants_title', { count: activeParticipants.length }),
        value,
      });
    }

    // Total
    embed.addFields({
      name: '\u200b',
      value: tWithLocale(locale, 'summary.total', { count: activeParticipants.length }),
    });

    return embed;
  }
}
