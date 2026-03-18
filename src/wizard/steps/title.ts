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
import { CUSTOM_ID, EMBED_COLOR_OPEN, MAX_TITLE_LENGTH } from '../../config/constants';

export async function sendTitleStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.title_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.title_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  if (session.data.title) {
    embed.addFields({ name: 'Actuel', value: session.data.title });
  }

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:title`)
      .setLabel(tWithLocale(locale, 'wizard.title_label'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.WIZARD_PREV)
      .setLabel(tWithLocale(locale, 'wizard.btn_prev'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.isFirstStep),
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

export async function handleTitleInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  const locale = session.locale;

  if (interaction.isButton() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:title`) {
    const modal = new ModalBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:title_submit`)
      .setTitle(tWithLocale(locale, 'wizard.title_title'));

    const titleInput = new TextInputBuilder()
      .setCustomId('title_input')
      .setLabel(tWithLocale(locale, 'wizard.title_label'))
      .setPlaceholder(tWithLocale(locale, 'wizard.title_placeholder'))
      .setStyle(TextInputStyle.Short)
      .setMaxLength(MAX_TITLE_LENGTH)
      .setRequired(true);

    if (session.data.title) {
      titleInput.setValue(session.data.title);
    }

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:title_submit`) {
    const title = interaction.fields.getTextInputValue('title_input').trim();

    if (!title) {
      await interaction.reply({ content: '❌ Title is required.', ephemeral: true });
      return;
    }

    session.updateData({ title });
    await interaction.deferUpdate();
    session.nextStep();

    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
