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
import { CUSTOM_ID, EMBED_COLOR_OPEN, MAX_DESCRIPTION_LENGTH } from '../../config/constants';

export async function sendDescriptionStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.description_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.description_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  if (session.data.description) {
    embed.addFields({ name: 'Actuel', value: session.data.description.substring(0, 1024) });
  }

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:description`)
      .setLabel(tWithLocale(locale, 'wizard.description_label'))
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

export async function handleDescriptionInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  const locale = session.locale;

  if (interaction.isButton() && interaction.customId === CUSTOM_ID.WIZARD_SKIP) {
    session.updateData({ description: undefined });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
    return;
  }

  if (interaction.isButton() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:description`) {
    const modal = new ModalBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:description_submit`)
      .setTitle(tWithLocale(locale, 'wizard.description_title'));

    const input = new TextInputBuilder()
      .setCustomId('description_input')
      .setLabel(tWithLocale(locale, 'wizard.description_label'))
      .setPlaceholder(tWithLocale(locale, 'wizard.description_placeholder'))
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(MAX_DESCRIPTION_LENGTH)
      .setRequired(false);

    if (session.data.description) {
      input.setValue(session.data.description);
    }

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:description_submit`) {
    const description = interaction.fields.getTextInputValue('description_input').trim();
    session.updateData({ description: description || undefined });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
