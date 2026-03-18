import { Worker, type Job } from 'bullmq';
import { type Client, type TextChannel } from 'discord.js';
import { EventStatus } from '@prisma/client';
import { config } from '../../config';
import { QUEUE_CLEANUP, CLEANUP_DAYS_AFTER_EVENT } from '../../config/constants';
import { prisma } from '../../database/prisma';
import logger from '../../utils/logger';

/**
 * Worker de nettoyage des événements terminés
 * Exécuté quotidiennement, supprime les anciens événements et met à jour les statuts
 */
export function createCleanupWorker(client: Client): Worker {
  const worker = new Worker(
    QUEUE_CLEANUP,
    async (job: Job) => {
      logger.info('Running daily event cleanup');

      try {
        const now = new Date();

        // 1. Marque comme COMPLETED les événements passés encore OPEN/SCHEDULED
        const eventsToComplete = await prisma.event.findMany({
          where: {
            status: { in: [EventStatus.OPEN, EventStatus.SCHEDULED] },
            eventDate: { lt: now },
          },
        });

        for (const event of eventsToComplete) {
          await prisma.event.update({
            where: { id: event.id },
            data: { status: EventStatus.COMPLETED },
          });
          logger.info(`Marked event ${event.id} as COMPLETED (past date)`);
        }

        // 2. Supprime les événements terminés/annulés depuis plus de CLEANUP_DAYS_AFTER_EVENT jours
        const cleanupDate = new Date(now.getTime() - CLEANUP_DAYS_AFTER_EVENT * 24 * 60 * 60 * 1000);

        const oldEvents = await prisma.event.findMany({
          where: {
            status: { in: [EventStatus.COMPLETED, EventStatus.CANCELLED] },
            eventDate: { lt: cleanupDate },
          },
          select: { id: true, title: true, channelId: true, messageId: true, guildId: true },
        });

        for (const event of oldEvents) {
          // Tente de supprimer le message Discord
          if (event.messageId) {
            try {
              const guild = await client.guilds.fetch(event.guildId);
              const channel = await guild.channels.fetch(event.channelId) as TextChannel;
              if (channel && channel.isTextBased()) {
                const message = await channel.messages.fetch(event.messageId);
                await message.delete();
              }
            } catch {
              // Message déjà supprimé ou channel inaccessible
            }
          }

          await prisma.event.delete({ where: { id: event.id } });
          logger.info(`Cleaned up old event: ${event.title} (${event.id})`);
        }

        logger.info(`Cleanup complete: ${eventsToComplete.length} completed, ${oldEvents.length} deleted`);
      } catch (error) {
        logger.error('Cleanup worker error', { error });
        throw error;
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`Cleanup job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Cleanup job ${job?.id} failed`, { error: err.message });
  });

  return worker;
}
