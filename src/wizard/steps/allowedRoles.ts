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

export async function sendAllowedRolesStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;
  const guild = await client.guilds.fetch(session.guildId);
  const roles = await guild.roles.fetch();

  const availableRoles = roles
    .filter((r) => !r.managed && r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      label: r.name,
      value: r.id,
    }))
    .slice(0, 25);

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.allowed_roles_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.allowed_roles_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  if (session.data.allowedRoleNames && session.data.allowedRoleNames.length > 0) {
    embed.addFields({ name: 'Actuel', value: session.data.allowedRoleNames.join(', ') });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_ID.WIZARD_SELECT}:allowedRoles`)
    .setPlaceholder(tWithLocale(locale, 'wizard.allowed_roles_placeholder'))
    .setMinValues(0)
    .setMaxValues(Math.min(availableRoles.length, 25))
    .addOptions(
      availableRoles.length > 0
        ? availableRoles
        : [{ label: 'No roles available', value: 'none' }]
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

export async function handleAllowedRolesInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  if (interaction.isButton() && interaction.customId === CUSTOM_ID.WIZARD_SKIP) {
    session.updateData({ allowedRoles: [], allowedRoleNames: [] });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const roleIds = interaction.values.filter((v) => v !== 'none');

    if (roleIds.length === 0) {
      session.updateData({ allowedRoles: [], allowedRoleNames: [] });
    } else {
      const guild = await client.guilds.fetch(session.guildId);
      const roleNames: string[] = [];
      for (const id of roleIds) {
        const role = await guild.roles.fetch(id);
        roleNames.push(role?.name || id);
      }
      session.updateData({ allowedRoles: roleIds, allowedRoleNames: roleNames });
    }

    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
