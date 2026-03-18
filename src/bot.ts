import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType,
} from 'discord.js';
import { config } from './config';
import { handleInteraction } from './interactions';
import { GuildConfigService } from './services/GuildConfigService';
import { loadLocales } from './locales';
import { initScheduler, stopScheduler } from './scheduler';
import { prisma } from './database/prisma';
import logger from './utils/logger';

/**
 * Crée et configure le client Discord
 */
export function createBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.GuildMember,
    ],
  });

  // Événement: Bot prêt
  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`✅ Bot logged in as ${readyClient.user.tag}`);
    logger.info(`📊 Connected to ${readyClient.guilds.cache.size} guilds`);

    // Status du bot
    readyClient.user.setActivity('events | /event', { type: ActivityType.Watching });

    // Charge les locales
    loadLocales();

    // Initialise le scheduler BullMQ
    await initScheduler(client);

    // Enregistre les guilds existantes
    for (const [guildId, guild] of readyClient.guilds.cache) {
      await GuildConfigService.getOrCreate(guildId, guild.name).catch((err) => {
        logger.error(`Failed to register guild ${guildId}`, { error: err });
      });
    }

    logger.info('🚀 Bot fully initialized');
  });

  // Événement: Nouvelle guild
  client.on(Events.GuildCreate, async (guild) => {
    logger.info(`📥 Joined guild: ${guild.name} (${guild.id})`);
    await GuildConfigService.getOrCreate(guild.id, guild.name);
  });

  // Événement: Quitte une guild
  client.on(Events.GuildDelete, async (guild) => {
    logger.info(`📤 Left guild: ${guild.name} (${guild.id})`);
    // On ne supprime pas les données — elles seront nettoyées par le cleanup worker
  });

  // Événement: Mise à jour d'une guild
  client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
    if (oldGuild.name !== newGuild.name) {
      await GuildConfigService.updateName(newGuild.id, newGuild.name);
    }
  });

  // Événement: Interaction (slash commands, boutons, select menus, modals)
  client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(interaction, client);
  });

  // Événement: Erreur
  client.on(Events.Error, (error) => {
    logger.error('Discord client error', { error });
  });

  // Événement: Warning
  client.on(Events.Warn, (message) => {
    logger.warn('Discord client warning', { message });
  });

  return client;
}

/**
 * Arrête proprement le bot
 */
export async function shutdownBot(client: Client): Promise<void> {
  logger.info('Shutting down bot...');

  await stopScheduler();
  await prisma.$disconnect();
  client.destroy();

  logger.info('Bot shut down complete');
}
