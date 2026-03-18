import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { WizardSession } from '../WizardSession';
import { tWithLocale } from '../../locales';
import { CUSTOM_ID, EMBED_COLOR_OPEN } from '../../config/constants';
import { parseDateTime, isFutureDate, discordTimestamp } from '../../utils/dateUtils';

export async function sendCloseDateStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.close_date_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.close_date_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  if (session.data.closeAt) {
    embed.addFields({ name: 'Actuel', value: discordTimestamp(session.data.closeAt, 'F') });
  }

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:closeDate`)
      .setLabel(tWithLocale(locale, 'wizard.close_date_label'))
      .setStyle(ButtonStyle.Primary),
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
    components: [buttonRow],
  });
}

export async function handleCloseDateInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  const locale = session.locale;

  if (interaction.isButton() && interaction.customId === CUSTOM_ID.WIZARD_SKIP) {
    session.updateData({ closeAt: undefined });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
    return;
  }

  if (interaction.isButton() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:closeDate`) {
    const modal = new ModalBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:closeDate_submit`)
      .setTitle(tWithLocale(locale, 'wizard.close_date_title'));

    const input = new TextInputBuilder()
      .setCustomId('close_date_input')
      .setLabel(tWithLocale(locale, 'wizard.close_date_label'))
      .setPlaceholder(tWithLocale(locale, 'wizard.close_date_placeholder'))
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:closeDate_submit`) {
    const dateStr = interaction.fields.getTextInputValue('close_date_input');
    const parsed = parseDateTime(dateStr, session.timezone);

    if (!parsed) {
      await interaction.reply({
        content: tWithLocale(locale, 'wizard.datetime_invalid'),
        ephemeral: true,
      });
      return;
    }

    if (!isFutureDate(parsed)) {
      await interaction.reply({
        content: tWithLocale(locale, 'wizard.datetime_past'),
        ephemeral: true,
      });
      return;
    }

    session.updateData({ closeAt: parsed });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
