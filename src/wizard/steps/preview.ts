import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { WizardSession } from '../WizardSession';
import { tWithLocale } from '../../locales';
import { CUSTOM_ID, EMBED_COLOR_OPEN } from '../../config/constants';
import { discordTimestamp, formatDuration } from '../../utils/dateUtils';

export async function sendPreviewStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;
  const data = session.data;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.preview_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.preview_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  const none = tWithLocale(locale, 'wizard.preview_none');

  // Channel
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_channel'),
    value: data.channelName || none,
    inline: true,
  });

  // Title
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_title'),
    value: data.title || none,
    inline: true,
  });

  // Description
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_description'),
    value: data.description ? data.description.substring(0, 200) + (data.description.length > 200 ? '...' : '') : none,
    inline: false,
  });

  // Date
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_date'),
    value: data.dateTime ? discordTimestamp(data.dateTime, 'F') : none,
    inline: true,
  });

  // Duration
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_duration'),
    value: data.duration ? formatDuration(data.duration, locale) : none,
    inline: true,
  });

  // Template
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_template'),
    value: data.templateName || none,
    inline: true,
  });

  // Max participants
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_max'),
    value: data.maxParticipants
      ? data.maxParticipants.toString()
      : tWithLocale(locale, 'wizard.preview_unlimited'),
    inline: true,
  });

  // Ping role
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_ping'),
    value: data.pingRoleName || none,
    inline: true,
  });

  // Allowed roles
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_roles'),
    value: data.allowedRoleNames && data.allowedRoleNames.length > 0
      ? data.allowedRoleNames.join(', ')
      : tWithLocale(locale, 'wizard.preview_everyone'),
    inline: true,
  });

  // Close date
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_close'),
    value: data.closeAt ? discordTimestamp(data.closeAt, 'F') : none,
    inline: true,
  });

  // Reminders
  const reminderLabels: Record<number, string> = {
    15: tWithLocale(locale, 'wizard.reminder_15m'),
    30: tWithLocale(locale, 'wizard.reminder_30m'),
    60: tWithLocale(locale, 'wizard.reminder_1h'),
    120: tWithLocale(locale, 'wizard.reminder_2h'),
    360: tWithLocale(locale, 'wizard.reminder_6h'),
    720: tWithLocale(locale, 'wizard.reminder_12h'),
    1440: tWithLocale(locale, 'wizard.reminder_24h'),
    2880: tWithLocale(locale, 'wizard.reminder_48h'),
  };
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_reminders'),
    value: data.reminders && data.reminders.length > 0
      ? data.reminders.map((m) => reminderLabels[m] || `${m}min`).join(', ')
      : none,
    inline: true,
  });

  // Recurrence
  const recurrenceLabels: Record<string, string> = {
    DAILY: tWithLocale(locale, 'wizard.recurrence_daily'),
    WEEKLY: tWithLocale(locale, 'wizard.recurrence_weekly'),
    BIWEEKLY: tWithLocale(locale, 'wizard.recurrence_biweekly'),
    MONTHLY: tWithLocale(locale, 'wizard.recurrence_monthly'),
  };
  embed.addFields({
    name: tWithLocale(locale, 'wizard.preview_field_recurrence'),
    value: data.recurrencePattern
      ? recurrenceLabels[data.recurrencePattern] || none
      : none,
    inline: true,
  });

  // Image
  if (data.imageUrl) {
    embed.setImage(data.imageUrl);
  }

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.WIZARD_CONFIRM)
      .setLabel(tWithLocale(locale, 'wizard.btn_confirm'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.WIZARD_PREV)
      .setLabel(tWithLocale(locale, 'wizard.btn_edit'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.WIZARD_CANCEL)
      .setLabel(tWithLocale(locale, 'wizard.btn_cancel'))
      .setStyle(ButtonStyle.Danger)
  );

  await session.dmChannel.send({
    embeds: [embed],
    components: [buttonRow],
  });
}

export async function handlePreviewInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!interaction.isButton()) return;

  if (interaction.customId === CUSTOM_ID.WIZARD_CONFIRM) {
    await interaction.deferUpdate();

    // Finalise la création
    const { finalizeWizard } = await import('../index');
    await finalizeWizard(session, client);
    return;
  }

  // WIZARD_PREV et WIZARD_CANCEL sont gérés dans le handler principal du wizard
}
