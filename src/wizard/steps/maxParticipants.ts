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
import { CUSTOM_ID, EMBED_COLOR_OPEN, MAX_PARTICIPANTS_LIMIT } from '../../config/constants';

export async function sendMaxParticipantsStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.max_participants_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.max_participants_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  if (session.data.maxParticipants) {
    embed.addFields({ name: 'Actuel', value: session.data.maxParticipants.toString() });
  }

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:maxParticipants`)
      .setLabel(tWithLocale(locale, 'wizard.max_participants_label'))
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

export async function handleMaxParticipantsInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  const locale = session.locale;

  if (interaction.isButton() && interaction.customId === CUSTOM_ID.WIZARD_SKIP) {
    session.updateData({ maxParticipants: undefined });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
    return;
  }

  if (interaction.isButton() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:maxParticipants`) {
    const modal = new ModalBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:maxParticipants_submit`)
      .setTitle(tWithLocale(locale, 'wizard.max_participants_title'));

    const input = new TextInputBuilder()
      .setCustomId('max_input')
      .setLabel(tWithLocale(locale, 'wizard.max_participants_label'))
      .setPlaceholder(tWithLocale(locale, 'wizard.max_participants_placeholder'))
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:maxParticipants_submit`) {
    const value = parseInt(interaction.fields.getTextInputValue('max_input'), 10);

    if (isNaN(value) || value < 1 || value > MAX_PARTICIPANTS_LIMIT) {
      await interaction.reply({
        content: tWithLocale(locale, 'wizard.max_participants_invalid'),
        ephemeral: true,
      });
      return;
    }

    session.updateData({ maxParticipants: value });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
