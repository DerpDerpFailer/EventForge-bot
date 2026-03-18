import { type StringSelectMenuInteraction, type Client } from 'discord.js';
import { CUSTOM_ID } from '../config/constants';
import { handleEventMenuSelection } from '../commands/event';
import { handleConfigMenuSelection, handleConfigSave } from '../commands/eventConfig';
import { handleWizardInteraction } from '../wizard';
import logger from '../utils/logger';

/**
 * Dispatche les interactions de select menus
 */
export async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
  client: Client
): Promise<void> {
  const customId = interaction.customId;

  // Menu principal /event
  if (customId === CUSTOM_ID.EVENT_MENU) {
    await handleEventMenuSelection(interaction);
    return;
  }

  // Menu de configuration
  if (customId === CUSTOM_ID.CONFIG_MENU) {
    await handleConfigMenuSelection(interaction);
    return;
  }

  // Sauvegardes de configuration
  if (
    customId.startsWith(CUSTOM_ID.CONFIG_CHANNELS) ||
    customId.startsWith(CUSTOM_ID.CONFIG_ROLES) ||
    customId.startsWith(CUSTOM_ID.CONFIG_STATS_CHANNEL) ||
    customId.startsWith(CUSTOM_ID.CONFIG_REMINDERS) ||
    customId.startsWith(CUSTOM_ID.CONFIG_LOCALE)
  ) {
    await handleConfigSave(interaction);
    return;
  }

  // Select menus du wizard
  if (customId.startsWith(CUSTOM_ID.WIZARD_SELECT)) {
    await handleWizardInteraction(interaction, client);
    return;
  }

  logger.warn(`Unhandled select menu interaction: ${customId}`);
}
