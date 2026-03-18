import { type Interaction, type Client } from 'discord.js';
import { commands } from '../commands';
import { handleButtonInteraction } from './buttons';
import { handleSelectMenuInteraction } from './selectMenus';
import { handleModalInteraction } from './modals';
import logger from '../utils/logger';

/**
 * Handler principal pour toutes les interactions Discord
 */
export async function handleInteraction(
  interaction: Interaction,
  client: Client
): Promise<void> {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
      }

      await command.execute(interaction);
      return;
    }

    // Boutons
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction, client);
      return;
    }

    // Select menus
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction, client);
      return;
    }

    // Modals
    if (interaction.isModalSubmit()) {
      await handleModalInteraction(interaction, client);
      return;
    }

    // Autocomplete et autres interactions non gérées
    if (interaction.isAutocomplete()) {
      // Pas d'autocomplete pour l'instant
      return;
    }
  } catch (error) {
    logger.error('Interaction handler error', {
      error,
      type: interaction.type,
      customId: 'customId' in interaction ? (interaction as { customId: string }).customId : undefined,
    });

    // Tente d'envoyer un message d'erreur
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An unexpected error occurred.',
          ephemeral: true,
        });
      } else if (interaction.isRepliable() && interaction.deferred) {
        await interaction.followUp({
          content: '❌ An unexpected error occurred.',
          ephemeral: true,
        });
      }
    } catch {
      // Impossible de répondre — on log juste
    }
  }
}
