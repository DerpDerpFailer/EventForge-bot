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
import { WizardSession } from '../WizardSession';
import { tWithLocale } from '../../locales';
import { CUSTOM_ID, EMBED_COLOR_OPEN } from '../../config/constants';

const REMINDER_OPTIONS = [
  { minutes: 15, key: 'wizard.reminder_15m' },
  { minutes: 30, key: 'wizard.reminder_30m' },
  { minutes: 60, key: 'wizard.reminder_1h' },
  { minutes: 120, key: 'wizard.reminder_2h' },
  { minutes: 360, key: 'wizard.reminder_6h' },
  { minutes: 720, key: 'wizard.reminder_12h' },
  { minutes: 1440, key: 'wizard.reminder_24h' },
  { minutes: 2880, key: 'wizard.reminder_48h' },
];

export async function sendRemindersStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.reminders_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.reminders_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_ID.WIZARD_SELECT}:reminders`)
    .setPlaceholder(tWithLocale(locale, 'wizard.reminders_placeholder'))
    .setMinValues(0)
    .setMaxValues(REMINDER_OPTIONS.length)
    .addOptions(
      REMINDER_OPTIONS.map((opt) => ({
        label: tWithLocale(locale, opt.key),
        value: opt.minutes.toString(),
        default: session.data.reminders?.includes(opt.minutes) || false,
      }))
    );

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

export async function handleRemindersInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  if (interaction.isButton() && interaction.customId === CUSTOM_ID.WIZARD_SKIP) {
    session.updateData({ reminders: [] });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const reminders = interaction.values.map((v) => parseInt(v, 10));
    session.updateData({ reminders });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
