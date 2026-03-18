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
import { TemplateService } from '../../services/TemplateService';

export async function sendTemplateStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;
  const templates = await TemplateService.getGuildTemplates(session.guildId);

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.template_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.template_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  // Affiche un aperçu des options de chaque template
  for (const tpl of templates.slice(0, 5)) {
    const optionsPreview = tpl.options
      .map((o) => {
        const slots = o.maxSlots ? `(max ${o.maxSlots})` : '';
        return `${o.emoji} ${o.label} ${slots}`;
      })
      .join('\n');
    embed.addFields({ name: tpl.name, value: optionsPreview, inline: true });
  }

  if (session.data.templateName) {
    embed.setFooter({ text: `Actuel: ${session.data.templateName}` });
  }

  const options = templates.map((tpl) => ({
    label: tpl.name,
    value: tpl.id,
    description: tpl.options.map((o) => o.emoji).join(' '),
    default: tpl.id === session.data.templateId,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_ID.WIZARD_SELECT}:template`)
    .setPlaceholder(tWithLocale(locale, 'wizard.template_placeholder'))
    .addOptions(options.length > 0 ? options : [{ label: 'No templates', value: 'none' }]);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

export async function handleTemplateInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!interaction.isStringSelectMenu()) return;

  const templateId = interaction.values[0];
  if (templateId === 'none') return;

  const template = await TemplateService.getById(templateId);

  session.updateData({
    templateId: template.id,
    templateName: template.name,
  });

  await interaction.deferUpdate();
  session.nextStep();
  const { sendCurrentStep } = await import('../index');
  await sendCurrentStep(session, client);
}
