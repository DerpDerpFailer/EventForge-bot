import { Worker, type Job } from 'bullmq';
import { type Client, type TextChannel } from 'discord.js';
import { config } from '../../config';
import { QUEUE_RECURRENCE } from '../../config/constants';
import { RecurrenceService } from '../../services/RecurrenceService';
import { EventService } from '../../services/EventService';
import { EmbedService } from '../../services/EmbedService';
import logger from '../../utils/logger';
import type { RecurrenceJobData } from '../../types/events';

/**
 * Worker pour la création automatique des événements récurrents
 * Quand un événement récurrent arrive à sa date, ce worker crée la prochaine occurrence
 */
export function createRecurrenceWorker(client: Client): Worker {
  const worker = new Worker<RecurrenceJobData>(
    QUEUE_RECURRENCE,
    async (job: Job<RecurrenceJobData>) => {
      const { eventId, recurrenceId, guildId } = job.data;

      logger.info(`Processing recurrence for event ${eventId}`);

      try {
        // Crée la prochaine occurrence de l'événement
        const newEventId = await RecurrenceService.createNextOccurrence(eventId);
        if (!newEventId) {
          logger.info(`No next occurrence for event ${eventId} (end of recurrence)`);
          return;
        }

        // Récupère le nouvel événement pour publier l'embed
        const newEvent = await EventService.getById(newEventId);
        if (!newEvent) {
          logger.warn(`New recurring event ${newEventId} not found after creation`);
          return;
        }

        // Publie l'embed dans le channel d'origine
        try {
          const guild = await client.guilds.fetch(guildId);
          const channel = await guild.channels.fetch(newEvent.channelId) as TextChannel;

          if (channel && channel.isTextBased()) {
            const message = await EmbedService.publishOrUpdate(
              channel,
              newEvent,
              newEvent.pingRoleId
            );

            // Sauvegarde le messageId du nouvel événement
            await EventService.setMessageId(newEventId, message.id);
          }
        } catch (embedError) {
          logger.error(`Failed to publish embed for recurring event ${newEventId}`, { error: embedError });
        }

        logger.info(`Created recurring event ${newEventId} from ${eventId}`);
      } catch (error) {
        logger.error(`Failed to process recurrence for event ${eventId}`, { error });
        throw error;
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`Recurrence job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Recurrence job ${job?.id} failed`, { error: err.message });
  });

  return worker;
}
