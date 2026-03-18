import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { GuildConfigService } from '../services/GuildConfigService';
import { EventService } from '../services/EventService';
import { StatsService } from '../services/StatsService';
import { tWithLocale, t } from '../locales';
import { exportStatsCsv } from '../utils/csvExport';
import { canCreateEvent } from '../utils/permissions';
import { discordTimestamp } from '../utils/dateUtils';
import { CUSTOM_ID, EMBED_COLOR_OPEN } from '../config/constants';
import { startWizard } from '../wizard';
import logger from '../utils/logger';
import type { BotCommand } from '../types/commands';
import { AttachmentBuilder } from 'discord.js';
import { EventStatus } from '@prisma/client';

const data = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Event management menu')
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const guildConfig = await GuildConfigService.getOrCreate(interaction.guildId, interaction.guild.name);
  const locale = guildConfig.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'commands.event.menu_title'))
    .setDescription(tWithLocale(locale, 'commands.event.menu_description'))
    .setColor(EMBED_COLOR_OPEN);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.EVENT_MENU)
    .addOptions([
      {
        label: tWithLocale(locale, 'commands.event.menu_create'),
        description: tWithLocale(locale, 'commands.event.menu_create_desc'),
        value: CUSTOM_ID.EVENT_CREATE,
        emoji: '📝',
      },
      {
        label: tWithLocale(locale, 'commands.event.menu_my_events'),
        description: tWithLocale(locale, 'commands.event.menu_my_events_desc'),
        value: CUSTOM_ID.EVENT_MY_EVENTS,
        emoji: '📋',
      },
      {
        label: tWithLocale(locale, 'commands.event.menu_calendar'),
        description: tWithLocale(locale, 'commands.event.menu_calendar_desc'),
        value: CUSTOM_ID.EVENT_CALENDAR,
        emoji: '📅',
      },
      {
        label: tWithLocale(locale, 'commands.event.menu_stats'),
        description: tWithLocale(locale, 'commands.event.menu_stats_desc'),
        value: CUSTOM_ID.EVENT_STATS,
        emoji: '📊',
      },
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

/**
 * Gère les sélections du menu principal /event
 */
export async function handleEventMenuSelection(
  interaction: import('discord.js').StringSelectMenuInteraction
): Promise<void> {
  const value = interaction.values[0];
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const member = interaction.member as import('discord.js').GuildMember;

  const guildConfig = await GuildConfigService.getOrCreate(guildId, guild.name);
  const locale = guildConfig.locale;

  switch (value) {
    case CUSTOM_ID.EVENT_CREATE: {
      // Vérifie les permissions de création
      const canCreate = await canCreateEvent(member, guildId);
      if (!canCreate) {
        await interaction.reply({
          content: tWithLocale(locale, 'errors.no_permission'),
          ephemeral: true,
        });
        return;
      }

      // Lance le wizard en DM
      await interaction.deferUpdate();
      const dmChannel = await startWizard(interaction.user.id, guildId, interaction.client);

      if (!dmChannel) {
        await interaction.followUp({
          content: tWithLocale(locale, 'errors.dm_failed'),
          ephemeral: true,
        });
      }
      break;
    }

    case CUSTOM_ID.EVENT_MY_EVENTS: {
      await interaction.deferUpdate();
      const events = await EventService.getEventsForUser(guildId, interaction.user.id);

      if (events.length === 0) {
        await interaction.followUp({
          content: tWithLocale(locale, 'events.my_events_empty'),
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'events.my_events_title'))
        .setColor(EMBED_COLOR_OPEN);

      const lines = events.slice(0, 10).map((event) => {
        const participant = event.participants.find((p) => p.userId === interaction.user.id);
        const option = participant ? `${participant.optionEmoji} ${participant.optionLabel}` : '';
        return tWithLocale(locale, 'events.my_events_entry', {
          title: event.title,
          date: discordTimestamp(event.eventDate, 'R'),
          status: event.status,
          option,
        });
      });

      embed.setDescription(lines.join('\n\n'));

      await interaction.followUp({ embeds: [embed], ephemeral: true });
      break;
    }

    case CUSTOM_ID.EVENT_CALENDAR: {
      await interaction.deferUpdate();
      const events = await EventService.list({
        guildId,
        status: [EventStatus.OPEN, EventStatus.SCHEDULED],
        fromDate: new Date(),
      });

      if (events.length === 0) {
        await interaction.followUp({
          content: tWithLocale(locale, 'events.calendar_empty'),
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'events.calendar_title'))
        .setColor(EMBED_COLOR_OPEN);

      const lines = events.slice(0, 15).map((event) => {
        const activeCount = event.participants.filter((p) => !p.isWaitlisted).length;
        return tWithLocale(locale, 'events.calendar_entry', {
          title: event.title,
          date: discordTimestamp(event.eventDate, 'F'),
          participants: activeCount,
        });
      });

      embed.setDescription(lines.join('\n\n'));

      await interaction.followUp({ embeds: [embed], ephemeral: true });
      break;
    }

    case CUSTOM_ID.EVENT_STATS: {
      await interaction.deferUpdate();

      // Stats personnelles
      const userStats = await StatsService.getUserStats(guildId, interaction.user.id);
      const topStats = await StatsService.getTopParticipants(guildId, 10);

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'stats.title', { guild: guild.name }))
        .setColor(EMBED_COLOR_OPEN);

      // Stats personnelles
      if (userStats) {
        embed.addFields({
          name: tWithLocale(locale, 'stats.your_stats'),
          value: [
            tWithLocale(locale, 'stats.your_attended', { count: userStats.attended }),
            tWithLocale(locale, 'stats.your_maybe', { count: userStats.maybe }),
            tWithLocale(locale, 'stats.your_declined', { count: userStats.declined }),
            tWithLocale(locale, 'stats.your_noshow', { count: userStats.noShow }),
          ].join('\n'),
        });
      }

      // Top participants
      if (topStats.length > 0) {
        const topLines = topStats.map((s, i) =>
          tWithLocale(locale, 'stats.row', {
            rank: i + 1,
            user: s.userName,
            attended: s.attended,
            maybe: s.maybe,
            declined: s.declined,
          })
        );

        embed.addFields({
          name: tWithLocale(locale, 'stats.header'),
          value: topLines.join('\n'),
        });
      } else {
        embed.setDescription(tWithLocale(locale, 'stats.empty'));
      }

      // Export CSV en fichier attaché
      const allStats = await StatsService.getAllStats(guildId);
      if (allStats.length > 0) {
        const csv = exportStatsCsv(allStats);
        const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), {
          name: 'stats.csv',
        });
        await interaction.followUp({ embeds: [embed], files: [attachment], ephemeral: true });
      } else {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      }
      break;
    }

    default:
      break;
  }
}

export const eventCommand: BotCommand = { data, execute };
