import { Worker, type Job } from 'bullmq';
import { type Client } from 'discord.js';
import { config } from '../../config';
import { QUEUE_SUMMARY } from '../../config/constants';
import { EventService } from '../../services/EventService';
import { SummaryService } from '../../services/SummaryService';
import logger from '../../utils/logger';
import type { SummaryJobData } from '../../types/events';

/**
 * Worker pour l'envoi des résumés post-événement
 */
export function createSummaryWorker(client: Client): Worker {
  const worker = new Worker<SummaryJobData>(
    QUEUE_SUMMARY,
    async (job: Job<SummaryJobData>) => {
      const { eventId } = job.data;

      logger.info(`Processing summary for event ${eventId}`);

      try {
        // Marque l'événement comme terminé s'il ne l'est pas encore
        const event = await EventService.getById(eventId);
        if (!event) {
          logger.warn(`Event ${eventId} not found for summary`);
          return;
        }

        if (event.status !== 'COMPLETED' && event.status !== 'CANCELLED') {
          await EventService.complete(eventId);
        }

        // Envoie le résumé
        await SummaryService.sendSummary(eventId, client);

        logger.info(`Summary processed for event ${eventId}`);
      } catch (error) {
        logger.error(`Failed to process summary for event ${eventId}`, { error });
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
    logger.debug(`Summary job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Summary job ${job?.id} failed`, { error: err.message });
  });

  return worker;
}
