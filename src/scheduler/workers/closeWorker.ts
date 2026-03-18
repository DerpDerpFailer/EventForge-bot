import { Worker, type Job } from 'bullmq';
import { type Client, type TextChannel } from 'discord.js';
import { config } from '../../config';
import { QUEUE_CLOSE } from '../../config/constants';
import { EventService } from '../../services/EventService';
import { EmbedService } from '../../services/EmbedService';
import logger from '../../utils/logger';
import type { CloseJobData } from '../../types/events';

/**
 * Worker pour la fermeture automatique des inscriptions
 */
export function createCloseWorker(client: Client): Worker {
  const worker = new Worker<CloseJobData>(
    QUEUE_CLOSE,
    async (job: Job<CloseJobData>) => {
      const { eventId, channelId, guildId } = job.data;

      logger.info(`Processing close registration for event ${eventId}`);

      try {
        const event = await EventService.getById(eventId);
        if (!event) {
          logger.warn(`Event ${eventId} not found for close job`);
          return;
        }

        // Ne pas fermer si déjà fermé, terminé ou annulé
        if (event.status !== 'OPEN' && event.status !== 'SCHEDULED') {
          logger.info(`Skipping close for event ${eventId} (status: ${event.status})`);
          return;
        }

        // Ferme les inscriptions
        await EventService.closeRegistrations(eventId);

        // Met à jour l'embed Discord
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId) as TextChannel;

        if (channel && channel.isTextBased()) {
          const updatedEvent = await EventService.getById(eventId);
          if (updatedEvent) {
            await EmbedService.refreshEmbed(channel, updatedEvent);
          }
        }

        logger.info(`Registrations closed for event ${eventId}`);
      } catch (error) {
        logger.error(`Failed to close registrations for event ${eventId}`, { error });
        throw error;
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`Close job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Close job ${job?.id} failed`, { error: err.message });
  });

  return worker;
}
