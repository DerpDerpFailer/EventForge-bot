import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { RecurrencePattern } from '@prisma/client';
import { WizardSession } from '../WizardSession';
import { tWithLocale } from '../../locales';
import { CUSTOM_ID, EMBED_COLOR_OPEN } from '../../config/constants';

export async function sendRecurrenceStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.recurrence_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.recurrence_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_ID.WIZARD_SELECT}:recurrence`)
    .setPlaceholder(tWithLocale(locale, 'wizard.recurrence_placeholder'))
    .addOptions([
      { label: tWithLocale(locale, 'wizard.recurrence_none'), value: 'none' },
      { label: tWithLocale(locale, 'wizard.recurrence_daily'), value: 'DAILY' },
      { label: tWithLocale(locale, 'wizard.recurrence_weekly'), value: 'WEEKLY' },
      { label: tWithLocale(locale, 'wizard.recurrence_biweekly'), value: 'BIWEEKLY' },
      { label: tWithLocale(locale, 'wizard.recurrence_monthly'), value: 'MONTHLY' },
    ]);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.WIZARD_SKIP)
      .setLabel(tWithLocale(locale, 'wizard.btn_skip'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.WIZARD_PREV)
      .setLabel(tWithLocale(locale, 'wizard.btn_prev'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.WIZARD_CANCEL)
      .setLabel(tWithLocale(locale, 'wizard.btn_cancel'))
      .setStyle(ButtonStyle.Danger)
  );

  await session.dmChannel.send({
    embeds: [embed],
    components: [selectRow, buttonRow],
  });
}

export async function handleRecurrenceInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  if (interaction.isButton() && interaction.customId === CUSTOM_ID.WIZARD_SKIP) {
    session.updateData({
      recurrencePattern: undefined,
      recurrenceInterval: undefined,
      recurrenceDayOfWeek: undefined,
      recurrenceEndDate: undefined,
    });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const value = interaction.values[0];

    if (value === 'none') {
      session.updateData({
        recurrencePattern: undefined,
        recurrenceInterval: undefined,
        recurrenceDayOfWeek: undefined,
        recurrenceEndDate: undefined,
      });
    } else {
      const pattern = value as RecurrencePattern;
      // Calcule le dayOfWeek si c'est weekly à partir de la date de l'événement
      let dayOfWeek: number | undefined;
      if ((pattern === 'WEEKLY' || pattern === 'BIWEEKLY') && session.data.dateTime) {
        dayOfWeek = session.data.dateTime.getDay();
      }

      session.updateData({
        recurrencePattern: pattern,
        recurrenceInterval: 1,
        recurrenceDayOfWeek: dayOfWeek,
      });
    }

    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
