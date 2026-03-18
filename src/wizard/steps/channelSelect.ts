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
import { prisma } from '../../database/prisma';
import logger from '../../utils/logger';

export async function sendChannelSelectStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!session.dmChannel) return;

  const locale = session.locale;
  const guild = await client.guilds.fetch(session.guildId);

  // Récupère les channels autorisés
  const guildConfig = await prisma.guild.findUnique({
    where: { id: session.guildId },
    select: { allowedChannels: true },
  });

  const channels = await guild.channels.fetch();
  const textChannels = channels.filter(
    (ch) => ch !== null && ch.isTextBased() && !ch.isThread() && !ch.isDMBased()
  );

  // Filtre par channels autorisés si configuré
  const allowedChannels = guildConfig?.allowedChannels || [];
  const filteredChannels = allowedChannels.length > 0
    ? textChannels.filter((ch) => allowedChannels.includes(ch!.id))
    : textChannels;

  const options = filteredChannels
    .map((ch) => ({
      label: `#${ch!.name}`,
      value: ch!.id,
      description: ch!.parent?.name || undefined,
    }))
    .slice(0, 25); // Discord limit

  const embed = new EmbedBuilder()
    .setTitle(tWithLocale(locale, 'wizard.channel_title'))
    .setDescription(
      `${tWithLocale(locale, 'wizard.step_indicator', {
        current: session.stepNumber,
        total: session.totalSteps,
      })}\n\n${tWithLocale(locale, 'wizard.channel_description')}`
    )
    .setColor(EMBED_COLOR_OPEN);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_ID.WIZARD_SELECT}:channelSelect`)
    .setPlaceholder(tWithLocale(locale, 'wizard.channel_placeholder'))
    .addOptions(options.length > 0 ? options : [{ label: 'No channels available', value: 'none' }]);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

export async function handleChannelSelectInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
): Promise<void> {
  if (!interaction.isStringSelectMenu()) return;

  const channelId = interaction.values[0];
  if (channelId === 'none') return;

  const guild = await client.guilds.fetch(session.guildId);
  const channel = await guild.channels.fetch(channelId);

  session.updateData({
    channelId,
    channelName: channel ? `#${channel.name}` : channelId,
  });

  await interaction.deferUpdate();
  session.nextStep();

  // Dynamically import to avoid circular dependency
  const { sendCurrentStep } = await import('../index');
  await sendCurrentStep(session, client);
}
