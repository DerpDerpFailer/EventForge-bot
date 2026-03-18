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

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function sendImageStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.image_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.image_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  if (session.data.imageUrl) {
    embed.setThumbnail(session.data.imageUrl);
  }

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:image`)
      .setLabel(tWithLocale(locale, 'wizard.image_label'))
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

export async function handleImageInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  const locale = session.locale;

  if (interaction.isButton() && interaction.customId === CUSTOM_ID.WIZARD_SKIP) {
    session.updateData({ imageUrl: undefined });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
    return;
  }

  if (interaction.isButton() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:image`) {
    const modal = new ModalBuilder()
      .setCustomId(`${CUSTOM_ID.WIZARD_MODAL}:image_submit`)
      .setTitle(tWithLocale(locale, 'wizard.image_title'));

    const input = new TextInputBuilder()
      .setCustomId('image_input')
      .setLabel(tWithLocale(locale, 'wizard.image_label'))
      .setPlaceholder(tWithLocale(locale, 'wizard.image_placeholder'))
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    if (session.data.imageUrl) {
      input.setValue(session.data.imageUrl);
    }

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === `${CUSTOM_ID.WIZARD_MODAL}:image_submit`) {
    const url = interaction.fields.getTextInputValue('image_input').trim();

    if (url && !isValidUrl(url)) {
      await interaction.reply({
        content: tWithLocale(locale, 'wizard.image_invalid'),
        ephemeral: true,
      });
      return;
    }

    session.updateData({ imageUrl: url || undefined });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
