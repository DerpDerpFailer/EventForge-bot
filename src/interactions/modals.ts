import { type ModalSubmitInteraction, type Client } from 'discord.js';
import { CUSTOM_ID } from '../config/constants';
import { handleConfigModal } from '../commands/eventConfig';
import { handleWizardInteraction } from '../wizard';
import logger from '../utils/logger';

/**
 * Dispatche les interactions de modals
 */
export async function handleModalInteraction(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  const customId = interaction.customId;

  // Modals de configuration
  if (customId.startsWith(CUSTOM_ID.CONFIG_MODAL)) {
    await handleConfigModal(interaction);
    return;
  }

  // Modals du wizard
  if (customId.startsWith(CUSTOM_ID.WIZARD_MODAL)) {
    await handleWizardInteraction(interaction, client);
    return;
  }

  logger.warn(`Unhandled modal interaction: ${customId}`);
}
