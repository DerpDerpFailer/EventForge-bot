import { prisma } from '../database/prisma';
import { invalidateLocaleCache } from '../locales';
import logger from '../utils/logger';
import type { GuildConfig, Locale } from '../types';

/**
 * Service de gestion de la configuration des guilds
 */
export class GuildConfigService {
  /**
   * Récupère ou crée la configuration d'une guild
   */
  static async getOrCreate(guildId: string, guildName?: string): Promise<GuildConfig> {
    let guild = await prisma.guild.findUnique({ where: { id: guildId } });

    if (!guild) {
      // Crée la guild avec les templates par défaut
      guild = await prisma.guild.create({
        data: {
          id: guildId,
          name: guildName || null,
        },
      });

      // Copie les templates par défaut depuis _default
      await this.copyDefaultTemplates(guildId);
      logger.info(`Guild created: ${guildId} (${guildName})`);
    }

    return {
      id: guild.id,
      name: guild.name,
      locale: guild.locale as Locale,
      timezone: guild.timezone,
      defaultReminders: guild.defaultReminders as number[],
      summaryChannelId: guild.summaryChannelId,
      statsChannelId: guild.statsChannelId,
      allowedChannels: guild.allowedChannels,
      creatorRoles: guild.creatorRoles,
    };
  }

  /**
   * Copie les templates par défaut dans une nouvelle guild
   */
  private static async copyDefaultTemplates(guildId: string): Promise<void> {
    const defaults = await prisma.template.findMany({
      where: { guildId: '_default', isDefault: true },
      include: { options: true },
    });

    for (const tpl of defaults) {
      await prisma.template.create({
        data: {
          guildId,
          name: tpl.name,
          isDefault: true,
          options: {
            create: tpl.options.map((opt) => ({
              emoji: opt.emoji,
              label: opt.label,
              maxSlots: opt.maxSlots,
              sortOrder: opt.sortOrder,
              category: opt.category,
            })),
          },
        },
      });
    }

    logger.info(`Copied ${defaults.length} default templates to guild ${guildId}`);
  }

  /**
   * Met à jour la locale d'une guild
   */
  static async setLocale(guildId: string, locale: Locale): Promise<void> {
    await prisma.guild.update({
      where: { id: guildId },
      data: { locale },
    });
    invalidateLocaleCache(guildId);
    logger.info(`Guild ${guildId} locale set to ${locale}`);
  }

  /**
   * Met à jour le fuseau horaire
   */
  static async setTimezone(guildId: string, timezone: string): Promise<void> {
    await prisma.guild.update({
      where: { id: guildId },
      data: { timezone },
    });
    logger.info(`Guild ${guildId} timezone set to ${timezone}`);
  }

  /**
   * Met à jour les channels autorisés
   */
  static async setAllowedChannels(guildId: string, channelIds: string[]): Promise<void> {
    await prisma.guild.update({
      where: { id: guildId },
      data: { allowedChannels: channelIds },
    });
    logger.info(`Guild ${guildId} allowed channels updated`, { channelIds });
  }

  /**
   * Met à jour les rôles créateurs
   */
  static async setCreatorRoles(guildId: string, roleIds: string[]): Promise<void> {
    await prisma.guild.update({
      where: { id: guildId },
      data: { creatorRoles: roleIds },
    });
    logger.info(`Guild ${guildId} creator roles updated`, { roleIds });
  }

  /**
   * Met à jour le channel de statistiques/résumés
   */
  static async setSummaryChannel(guildId: string, channelId: string | null): Promise<void> {
    await prisma.guild.update({
      where: { id: guildId },
      data: { summaryChannelId: channelId, statsChannelId: channelId },
    });
    logger.info(`Guild ${guildId} summary channel set to ${channelId}`);
  }

  /**
   * Met à jour les rappels par défaut
   */
  static async setDefaultReminders(guildId: string, reminders: number[]): Promise<void> {
    await prisma.guild.update({
      where: { id: guildId },
      data: { defaultReminders: reminders },
    });
    logger.info(`Guild ${guildId} default reminders updated`, { reminders });
  }

  /**
   * Récupère le timezone d'une guild
   */
  static async getTimezone(guildId: string): Promise<string> {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { timezone: true },
    });
    return guild?.timezone || 'Europe/Paris';
  }

  /**
   * Met à jour le nom de la guild (appelé au guildUpdate)
   */
  static async updateName(guildId: string, name: string): Promise<void> {
    await prisma.guild.updateMany({
      where: { id: guildId },
      data: { name },
    });
  }
}
