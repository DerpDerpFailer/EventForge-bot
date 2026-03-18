import { Queue } from 'bullmq';
import { config } from '../config';
import {
  QUEUE_REMINDERS,
  QUEUE_CLOSE,
  QUEUE_CLEANUP,
  QUEUE_SUMMARY,
  QUEUE_RECURRENCE,
} from '../config/constants';
import logger from '../utils/logger';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const reminderQueue = new Queue(QUEUE_REMINDERS, { connection });
export const closeQueue = new Queue(QUEUE_CLOSE, { connection });
export const cleanupQueue = new Queue(QUEUE_CLEANUP, { connection });
export const summaryQueue = new Queue(QUEUE_SUMMARY, { connection });
export const recurrenceQueue = new Queue(QUEUE_RECURRENCE, { connection });

/**
 * Initialise les queues avec les tâches récurrentes
 */
export async function initQueues(): Promise<void> {
  // Nettoyage des événements terminés — exécution quotidienne
  await cleanupQueue.add(
    'daily-cleanup',
    {},
    {
      repeat: {
        pattern: '0 3 * * *', // Tous les jours à 3h du matin
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );

  logger.info('BullMQ queues initialized');
}

/**
 * Ferme proprement toutes les queues
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    reminderQueue.close(),
    closeQueue.close(),
    cleanupQueue.close(),
    summaryQueue.close(),
    recurrenceQueue.close(),
  ]);
  logger.info('BullMQ queues closed');
}
