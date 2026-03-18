import { prisma } from '../database/prisma';
import { getReminderDate, isFutureDate } from '../utils/dateUtils';
import { scheduleReminder } from '../scheduler/jobs';
import logger from '../utils/logger';

/**
 * Service de gestion des rappels
 */
export class ReminderService {
  /**
   * Crée des rappels pour un événement
   */
  static async createReminders(
    eventId: string,
    guildId: string,
    channelId: string,
    eventDate: Date,
    minutesBeforeList: number[]
  ): Promise<void> {
    for (const minutesBefore of minutesBeforeList) {
      const scheduledAt = getReminderDate(eventDate, minutesBefore);

      // Ne pas créer de rappel dans le passé
      if (!isFutureDate(scheduledAt)) continue;

      const reminder = await prisma.reminder.create({
        data: {
          eventId,
          minutesBefore,
          scheduledAt,
        },
      });

      const jobId = await scheduleReminder(
        {
          eventId,
          reminderId: reminder.id,
          channelId,
          guildId,
          minutesBefore,
        },
        scheduledAt
      );

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { jobId },
      });

      logger.info(`Reminder created: ${minutesBefore}min before event ${eventId}`);
    }
  }

  /**
   * Marque un rappel comme envoyé
   */
  static async markSent(reminderId: string): Promise<void> {
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { sent: true },
    });
  }

  /**
   * Récupère les rappels non envoyés d'un événement
   */
  static async getPendingReminders(eventId: string) {
    return prisma.reminder.findMany({
      where: { eventId, sent: false },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Supprime tous les rappels d'un événement (ex: annulation)
   */
  static async deleteAllForEvent(eventId: string): Promise<void> {
    await prisma.reminder.deleteMany({ where: { eventId } });
    logger.info(`All reminders deleted for event ${eventId}`);
  }
}
