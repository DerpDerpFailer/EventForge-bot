import { config } from './config';
import { createBot, shutdownBot } from './bot';
import logger from './utils/logger';

async function main(): Promise<void> {
  logger.info('🚀 Starting EventForge.bot...');

  const client = createBot();

  // Gestion propre de l'arrêt
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await shutdownBot(client);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Gestion des erreurs non captées
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise: String(promise) });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });

  // Login
  try {
    await client.login(config.discord.token);
  } catch (error) {
    logger.error('Failed to login', { error });
    process.exit(1);
  }
}

main();
