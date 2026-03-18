import { REST, Routes } from 'discord.js';
import { config } from './config';
import { getCommandsData } from './commands';
import logger from './utils/logger';

async function deployCommands(): Promise<void> {
  const commands = getCommandsData();

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  logger.info(`Deploying ${commands.length} slash commands...`);

  try {
    // Enregistrement global (peut prendre jusqu'à 1h pour propager)
    const data = await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands }
    );

    logger.info(`✅ Successfully deployed ${(data as unknown[]).length} commands globally`);
  } catch (error) {
    logger.error('Failed to deploy commands', { error });
    process.exit(1);
  }
}

deployCommands();
