import { reminderQueue, closeQueue, summaryQueue, recurrenceQueue } from './queues';
import logger from '../utils/logger';
import type { ReminderJobData, CloseJobData, SummaryJobData, RecurrenceJobData } from '../types/events';

/**
 * Planifie un job de rappel
 */
export async function scheduleReminder(
  data: ReminderJobData,
  scheduledAt: Date
): Promise<string> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  const job = await reminderQueue.add('send-reminder', data, {
    delay,
    removeOnComplete: true,
    removeOnFail: 5,
    jobId: `reminder-${data.reminderId}`,
  });

  logger.info(`Scheduled reminder job ${job.id} for event ${data.eventId} at ${scheduledAt.toISOString()}`);
  return job.id || '';
}

/**
 * Planifie un job de fermeture des inscriptions
 */
export async function scheduleClose(
  data: CloseJobData,
  closeAt: Date
): Promise<string> {
  const delay = Math.max(0, closeAt.getTime() - Date.now());

  const job = await closeQueue.add('close-registrations', data, {
    delay,
    removeOnComplete: true,
    removeOnFail: 5,
    jobId: `close-${data.eventId}`,
  });

  logger.info(`Scheduled close job ${job.id} for event ${data.eventId} at ${closeAt.toISOString()}`);
  return job.id || '';
}

/**
 * Planifie un job de résumé post-événement
 */
export async function scheduleSummary(
  data: SummaryJobData,
  sendAt: Date
): Promise<string> {
  const delay = Math.max(0, sendAt.getTime() - Date.now());

  const job = await summaryQueue.add('send-summary', data, {
    delay,
    removeOnComplete: true,
    removeOnFail: 5,
    jobId: `summary-${data.eventId}`,
  });

  logger.info(`Scheduled summary job ${job.id} for event ${data.eventId} at ${sendAt.toISOString()}`);
  return job.id || '';
}

/**
 * Planifie un job de récurrence
 */
export async function scheduleRecurrence(
  data: RecurrenceJobData,
  nextRunAt: Date
): Promise<string> {
  const delay = Math.max(0, nextRunAt.getTime() - Date.now());

  const job = await recurrenceQueue.add('create-next-occurrence', data, {
    delay,
    removeOnComplete: true,
    removeOnFail: 5,
    jobId: `recurrence-${data.eventId}`,
  });

  logger.info(`Scheduled recurrence job ${job.id} for event ${data.eventId} at ${nextRunAt.toISOString()}`);
  return job.id || '';
}
