import { type Client } from 'discord.js';
import { type Worker } from 'bullmq';
import { initQueues, closeQueues } from './queues';
import { createReminderWorker } from './workers/reminderWorker';
import { createCloseWorker } from './workers/closeWorker';
import { createCleanupWorker } from './workers/cleanupWorker';
import { createSummaryWorker } from './workers/summaryWorker';
import { createRecurrenceWorker } from './workers/recurrenceWorker';
import logger from '../utils/logger';

let workers: Worker[] = [];

/**
 * Initialise le scheduler BullMQ avec tous les workers
 */
export async function initScheduler(client: Client): Promise<void> {
  // Initialise les queues et tâches récurrentes
  await initQueues();

  // Crée les workers
  workers = [
    createReminderWorker(client),
    createCloseWorker(client),
    createCleanupWorker(client),
    createSummaryWorker(client),
    createRecurrenceWorker(client),
  ];

  logger.info(`Scheduler initialized with ${workers.length} workers`);
}

/**
 * Arrête proprement le scheduler
 */
export async function stopScheduler(): Promise<void> {
  // Ferme les workers
  await Promise.all(workers.map((w) => w.close()));
  workers = [];

  // Ferme les queues
  await closeQueues();

  logger.info('Scheduler stopped');
}
