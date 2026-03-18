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

export async function sendPingRoleStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;
  const guild = await client.guilds.fetch(session.guildId);
  const roles = await guild.roles.fetch();

  // Filtre les rôles non-système mentionnables
  const availableRoles = roles
    .filter((r) => !r.managed && r.id !== guild.id) // exclut @everyone et rôles de bots
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      label: r.name,
      value: r.id,
    }))
    .slice(0, 24);

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.ping_role_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.ping_role_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  // Ajoute l'option "aucun rôle" en premier
  const options = [
    { label: tWithLocale(locale, 'wizard.ping_role_none'), value: 'none' },
    ...availableRoles,
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_ID.WIZARD_SELECT}:pingRole`)
    .setPlaceholder(tWithLocale(locale, 'wizard.ping_role_placeholder'))
    .addOptions(options);

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

export async function handlePingRoleInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  if (interaction.isButton() && interaction.customId === CUSTOM_ID.WIZARD_SKIP) {
    session.updateData({ pingRoleId: undefined, pingRoleName: undefined });
    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const roleId = interaction.values[0];

    if (roleId === 'none') {
      session.updateData({ pingRoleId: undefined, pingRoleName: undefined });
    } else {
      const guild = await client.guilds.fetch(session.guildId);
      const role = await guild.roles.fetch(roleId);
      session.updateData({
        pingRoleId: roleId,
        pingRoleName: role?.name || roleId,
      });
    }

    await interaction.deferUpdate();
    session.nextStep();
    const { sendCurrentStep } = await import('../index');
    await sendCurrentStep(session, client);
  }
}
