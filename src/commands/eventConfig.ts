import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type GuildMember,
  type TextChannel,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { GuildConfigService } from '../services/GuildConfigService';
import { TemplateService } from '../services/TemplateService';
import { tWithLocale } from '../locales';
import { canConfigureBot } from '../utils/permissions';
import { isValidTimezone } from '../utils/dateUtils';
import { CUSTOM_ID, EMBED_COLOR_OPEN } from '../config/constants';
import logger from '../utils/logger';
import type { BotCommand } from '../types/commands';

const data = new SlashCommandBuilder()
  .setName('eventconfig')
  .setDescription('Bot configuration (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: '❌ Server only.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!canConfigureBot(member)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  const guildConfig = await GuildConfigService.getOrCreate(interaction.guildId, interaction.guild.name);
  const locale = guildConfig.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'commands.config.menu_title'))
    .setDescription(tWithLocale(locale, 'commands.config.menu_description'))
    .setColor(EMBED_COLOR_OPEN);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CONFIG_MENU)
    .addOptions([
      {
        label: tWithLocale(locale, 'commands.config.channels'),
        description: tWithLocale(locale, 'commands.config.channels_desc'),
        value: CUSTOM_ID.CONFIG_CHANNELS,
        emoji: '📢',
      },
      {
        label: tWithLocale(locale, 'commands.config.roles'),
        description: tWithLocale(locale, 'commands.config.roles_desc'),
        value: CUSTOM_ID.CONFIG_ROLES,
        emoji: '👑',
      },
      {
        label: tWithLocale(locale, 'commands.config.stats_channel'),
        description: tWithLocale(locale, 'commands.config.stats_channel_desc'),
        value: CUSTOM_ID.CONFIG_STATS_CHANNEL,
        emoji: '📊',
      },
      {
        label: tWithLocale(locale, 'commands.config.reminders'),
        description: tWithLocale(locale, 'commands.config.reminders_desc'),
        value: CUSTOM_ID.CONFIG_REMINDERS,
        emoji: '⏰',
      },
      {
        label: tWithLocale(locale, 'commands.config.timezone'),
        description: tWithLocale(locale, 'commands.config.timezone_desc'),
        value: CUSTOM_ID.CONFIG_TIMEZONE,
        emoji: '🕐',
      },
      {
        label: tWithLocale(locale, 'commands.config.locale'),
        description: tWithLocale(locale, 'commands.config.locale_desc'),
        value: CUSTOM_ID.CONFIG_LOCALE,
        emoji: '🌐',
      },
      {
        label: tWithLocale(locale, 'commands.config.templates'),
        description: tWithLocale(locale, 'commands.config.templates_desc'),
        value: CUSTOM_ID.CONFIG_TEMPLATES,
        emoji: '📋',
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
 * Gère les sélections du menu de configuration
 */
export async function handleConfigMenuSelection(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const value = interaction.values[0];
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;

  const guildConfig = await GuildConfigService.getOrCreate(guildId, guild.name);
  const locale = guildConfig.locale;

  switch (value) {
    case CUSTOM_ID.CONFIG_CHANNELS: {
      const channels = await guild.channels.fetch();
      const textChannels = channels
        .filter((ch) => ch !== null && ch.isTextBased() && !ch.isThread() && !ch.isDMBased())
        .map((ch) => ({ label: `#${ch!.name}`, value: ch!.id }))
        .slice(0, 25);

      const currentList = guildConfig.allowedChannels.length > 0
        ? guildConfig.allowedChannels.map((id) => `<#${id}>`).join(', ')
        : tWithLocale(locale, 'config.channels_all');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_ID.CONFIG_CHANNELS}:save`)
        .setPlaceholder(tWithLocale(locale, 'commands.config.channels'))
        .setMinValues(0)
        .setMaxValues(Math.min(textChannels.length, 25))
        .addOptions(textChannels);

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'config.channels_title'))
        .setDescription(tWithLocale(locale, 'config.channels_description', { current: currentList }))
        .setColor(EMBED_COLOR_OPEN);

      await interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
      });
      break;
    }

    case CUSTOM_ID.CONFIG_ROLES: {
      const roles = await guild.roles.fetch();
      const availableRoles = roles
        .filter((r) => !r.managed && r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ label: r.name, value: r.id }))
        .slice(0, 25);

      const currentList = guildConfig.creatorRoles.length > 0
        ? guildConfig.creatorRoles.map((id) => `<@&${id}>`).join(', ')
        : tWithLocale(locale, 'config.roles_all');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_ID.CONFIG_ROLES}:save`)
        .setPlaceholder(tWithLocale(locale, 'commands.config.roles'))
        .setMinValues(0)
        .setMaxValues(Math.min(availableRoles.length, 25))
        .addOptions(availableRoles.length > 0 ? availableRoles : [{ label: 'No roles', value: 'none' }]);

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'config.roles_title'))
        .setDescription(tWithLocale(locale, 'config.roles_description', { current: currentList }))
        .setColor(EMBED_COLOR_OPEN);

      await interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
      });
      break;
    }

    case CUSTOM_ID.CONFIG_STATS_CHANNEL: {
      const channels = await guild.channels.fetch();
      const textChannels = channels
        .filter((ch) => ch !== null && ch.isTextBased() && !ch.isThread() && !ch.isDMBased())
        .map((ch) => ({ label: `#${ch!.name}`, value: ch!.id }))
        .slice(0, 25);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_ID.CONFIG_STATS_CHANNEL}:save`)
        .setPlaceholder(tWithLocale(locale, 'commands.config.stats_channel'))
        .addOptions(textChannels);

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'config.stats_channel_title'))
        .setDescription(tWithLocale(locale, 'config.stats_channel_description'))
        .setColor(EMBED_COLOR_OPEN);

      await interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
      });
      break;
    }

    case CUSTOM_ID.CONFIG_REMINDERS: {
      const options = [
        { label: '15 min', value: '15' },
        { label: '30 min', value: '30' },
        { label: '1h', value: '60' },
        { label: '2h', value: '120' },
        { label: '6h', value: '360' },
        { label: '12h', value: '720' },
        { label: '24h', value: '1440' },
        { label: '48h', value: '2880' },
      ];

      const currentReminders = guildConfig.defaultReminders as number[];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_ID.CONFIG_REMINDERS}:save`)
        .setPlaceholder(tWithLocale(locale, 'commands.config.reminders'))
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(
          options.map((o) => ({
            ...o,
            default: currentReminders.includes(parseInt(o.value, 10)),
          }))
        );

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'config.reminders_title'))
        .setDescription(tWithLocale(locale, 'config.reminders_description'))
        .setColor(EMBED_COLOR_OPEN);

      await interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
      });
      break;
    }

    case CUSTOM_ID.CONFIG_TIMEZONE: {
      const modal = new ModalBuilder()
        .setCustomId(`${CUSTOM_ID.CONFIG_MODAL}:timezone`)
        .setTitle(tWithLocale(locale, 'config.timezone_title'));

      const input = new TextInputBuilder()
        .setCustomId('timezone_input')
        .setLabel(tWithLocale(locale, 'config.timezone_label'))
        .setPlaceholder(tWithLocale(locale, 'config.timezone_placeholder'))
        .setStyle(TextInputStyle.Short)
        .setValue(guildConfig.timezone)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      break;
    }

    case CUSTOM_ID.CONFIG_LOCALE: {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_ID.CONFIG_LOCALE}:save`)
        .addOptions([
          { label: tWithLocale(locale, 'config.locale_fr'), value: 'fr', default: guildConfig.locale === 'fr' },
          { label: tWithLocale(locale, 'config.locale_en'), value: 'en', default: guildConfig.locale === 'en' },
        ]);

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'config.locale_title'))
        .setDescription(tWithLocale(locale, 'config.locale_description'))
        .setColor(EMBED_COLOR_OPEN);

      await interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
      });
      break;
    }

    case CUSTOM_ID.CONFIG_TEMPLATES: {
      const templates = await TemplateService.getGuildTemplates(guildId);

      const embed = new EmbedBuilder()
        .setTitle(tWithLocale(locale, 'config.templates_title'))
        .setDescription(tWithLocale(locale, 'config.templates_description'))
        .setColor(EMBED_COLOR_OPEN);

      for (const tpl of templates.slice(0, 10)) {
        const optionsText = tpl.options
          .map((o) => {
            const slots = o.maxSlots ? ` (max ${o.maxSlots})` : '';
            return `${o.emoji} ${o.label}${slots}`;
          })
          .join('\n');
        embed.addFields({
          name: `${tpl.name}${tpl.isDefault ? ' ⭐' : ''}`,
          value: optionsText || 'No options',
          inline: true,
        });
      }

      await interaction.update({
        embeds: [embed],
        components: [],
      });
      break;
    }

    default:
      break;
  }
}

/**
 * Gère les sauvegardes de configuration (select menu callbacks)
 */
export async function handleConfigSave(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const customId = interaction.customId;
  const guildId = interaction.guildId!;

  const guildConfig = await GuildConfigService.getOrCreate(guildId);
  const locale = guildConfig.locale;

  if (customId === `${CUSTOM_ID.CONFIG_CHANNELS}:save`) {
    await GuildConfigService.setAllowedChannels(guildId, interaction.values);
    await interaction.update({
      content: tWithLocale(locale, 'config.saved'),
      embeds: [],
      components: [],
    });
  } else if (customId === `${CUSTOM_ID.CONFIG_ROLES}:save`) {
    const roles = interaction.values.filter((v) => v !== 'none');
    await GuildConfigService.setCreatorRoles(guildId, roles);
    await interaction.update({
      content: tWithLocale(locale, 'config.saved'),
      embeds: [],
      components: [],
    });
  } else if (customId === `${CUSTOM_ID.CONFIG_STATS_CHANNEL}:save`) {
    await GuildConfigService.setSummaryChannel(guildId, interaction.values[0]);
    await interaction.update({
      content: tWithLocale(locale, 'config.saved'),
      embeds: [],
      components: [],
    });
  } else if (customId === `${CUSTOM_ID.CONFIG_REMINDERS}:save`) {
    const reminders = interaction.values.map((v) => parseInt(v, 10));
    await GuildConfigService.setDefaultReminders(guildId, reminders);
    await interaction.update({
      content: tWithLocale(locale, 'config.saved'),
      embeds: [],
      components: [],
    });
  } else if (customId === `${CUSTOM_ID.CONFIG_LOCALE}:save`) {
    const newLocale = interaction.values[0] as 'fr' | 'en';
    await GuildConfigService.setLocale(guildId, newLocale);
    await interaction.update({
      content: tWithLocale(newLocale, 'config.saved'),
      embeds: [],
      components: [],
    });
  }
}

/**
 * Gère les soumissions de modals de configuration
 */
export async function handleConfigModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const guildId = interaction.guildId!;
  const guildConfig = await GuildConfigService.getOrCreate(guildId);
  const locale = guildConfig.locale;

  if (interaction.customId === `${CUSTOM_ID.CONFIG_MODAL}:timezone`) {
    const timezone = interaction.fields.getTextInputValue('timezone_input').trim();

    if (!isValidTimezone(timezone)) {
      await interaction.reply({
        content: tWithLocale(locale, 'config.timezone_invalid'),
        ephemeral: true,
      });
      return;
    }

    await GuildConfigService.setTimezone(guildId, timezone);
    await interaction.reply({
      content: tWithLocale(locale, 'config.saved'),
      ephemeral: true,
    });
  }
}

export const eventConfigCommand: BotCommand = { data, execute };
