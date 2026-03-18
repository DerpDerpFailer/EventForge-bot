import { prisma } from '../database/prisma';
import { getNextOccurrence, isFutureDate } from '../utils/dateUtils';
import { scheduleRecurrence } from '../scheduler/jobs';
import logger from '../utils/logger';
import type { RecurrencePattern } from '@prisma/client';

/**
 * Service de gestion des récurrences d'événements
 */
export class RecurrenceService {
  /**
   * Calcule et enregistre la prochaine occurrence d'un événement récurrent
   */
  static async processRecurrence(eventId: string): Promise<Date | null> {
    const recurrence = await prisma.recurrence.findUnique({
      where: { eventId },
      include: { event: true },
    });

    if (!recurrence) {
      logger.warn(`No recurrence found for event ${eventId}`);
      return null;
    }

    const currentDate = recurrence.event.eventDate;
    const nextDate = getNextOccurrence(
      currentDate,
      recurrence.pattern,
      recurrence.interval
    );

    // Vérifie si la récurrence a une date de fin
    if (recurrence.endDate && nextDate > recurrence.endDate) {
      logger.info(`Recurrence ended for event ${eventId}`);
      return null;
    }

    // Vérifie que la prochaine date est dans le futur
    if (!isFutureDate(nextDate)) {
      logger.warn(`Next recurrence date is in the past for event ${eventId}`);
      return null;
    }

    // Met à jour le nextRunAt
    await prisma.recurrence.update({
      where: { id: recurrence.id },
      data: { nextRunAt: nextDate },
    });

    logger.info(`Next recurrence for event ${eventId}: ${nextDate.toISOString()}`);
    return nextDate;
  }

  /**
   * Crée un nouvel événement à partir d'un événement récurrent
   * Retourne l'ID du nouvel événement
   */
  static async createNextOccurrence(eventId: string): Promise<string | null> {
    const recurrence = await prisma.recurrence.findUnique({
      where: { eventId },
      include: {
        event: {
          include: {
            template: { include: { options: true } },
            reminders: true,
          },
        },
      },
    });

    if (!recurrence) return null;

    const nextDate = await this.processRecurrence(eventId);
    if (!nextDate) return null;

    const originalEvent = recurrence.event;

    // Crée le nouvel événement
    const newEvent = await prisma.event.create({
      data: {
        guildId: originalEvent.guildId,
        channelId: originalEvent.channelId,
        creatorId: originalEvent.creatorId,
        title: originalEvent.title,
        description: originalEvent.description,
        imageUrl: originalEvent.imageUrl,
        eventDate: nextDate,
        duration: originalEvent.duration,
        maxParticipants: originalEvent.maxParticipants,
        pingRoleId: originalEvent.pingRoleId,
        allowedRoles: originalEvent.allowedRoles,
        closeAt: originalEvent.closeAt
          ? new Date(nextDate.getTime() - (originalEvent.eventDate.getTime() - originalEvent.closeAt.getTime()))
          : null,
        templateId: originalEvent.templateId,
        status: 'OPEN',
      },
    });

    // Crée la récurrence pour le nouvel événement
    const newNextDate = getNextOccurrence(nextDate, recurrence.pattern, recurrence.interval);
    const newRecurrence = await prisma.recurrence.create({
      data: {
        eventId: newEvent.id,
        pattern: recurrence.pattern,
        interval: recurrence.interval,
        dayOfWeek: recurrence.dayOfWeek,
        endDate: recurrence.endDate,
        nextRunAt: newNextDate,
      },
    });

    // Planifie la prochaine récurrence
    if (!recurrence.endDate || newNextDate <= recurrence.endDate) {
      await scheduleRecurrence(
        {
          eventId: newEvent.id,
          recurrenceId: newRecurrence.id,
          guildId: originalEvent.guildId,
        },
        nextDate
      );
    }

    logger.info(`Created recurring event ${newEvent.id} from ${eventId}`);
    return newEvent.id;
  }

  /**
   * Supprime la récurrence d'un événement
   */
  static async deleteRecurrence(eventId: string): Promise<void> {
    await prisma.recurrence.deleteMany({ where: { eventId } });
    logger.info(`Recurrence deleted for event ${eventId}`);
  }
}
