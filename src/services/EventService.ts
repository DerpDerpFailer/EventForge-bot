import { EventStatus } from '@prisma/client';
import { prisma } from '../database/prisma';
import { EventNotFoundError, ValidationError } from '../utils/errors';
import { getReminderDate, isFutureDate } from '../utils/dateUtils';
import { scheduleReminder, scheduleClose, scheduleSummary, scheduleRecurrence } from '../scheduler/jobs';
import { SUMMARY_DELAY_MINUTES } from '../config/constants';
import logger from '../utils/logger';
import type { EventCreateData, EventWithDetails } from '../types';
import type { EventFilters } from '../types/events';

/**
 * Service CRUD pour les événements
 */
export class EventService {
  /**
   * Crée un nouvel événement avec ses rappels et récurrence
   */
  static async create(data: EventCreateData): Promise<EventWithDetails> {
    // Validation de base
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Event title is required.');
    }
    if (!isFutureDate(data.eventDate)) {
      throw new ValidationError('Event date must be in the future.');
    }

    const event = await prisma.event.create({
      data: {
        guildId: data.guildId,
        channelId: data.channelId,
        creatorId: data.creatorId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        imageUrl: data.imageUrl || null,
        eventDate: data.eventDate,
        duration: data.duration || null,
        maxParticipants: data.maxParticipants || null,
        pingRoleId: data.pingRoleId || null,
        allowedRoles: data.allowedRoles || [],
        closeAt: data.closeAt || null,
        templateId: data.templateId || null,
        status: EventStatus.OPEN,
      },
      include: {
        participants: true,
        template: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
        reminders: true,
        recurrence: true,
      },
    });

    // Crée les rappels
    if (data.reminders && data.reminders.length > 0) {
      for (const minutesBefore of data.reminders) {
        const scheduledAt = getReminderDate(data.eventDate, minutesBefore);
        if (isFutureDate(scheduledAt)) {
          const reminder = await prisma.reminder.create({
            data: {
              eventId: event.id,
              minutesBefore,
              scheduledAt,
            },
          });

          // Planifie le job BullMQ
          const jobId = await scheduleReminder({
            eventId: event.id,
            reminderId: reminder.id,
            channelId: event.channelId,
            guildId: event.guildId,
            minutesBefore,
          }, scheduledAt);

          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { jobId },
          });
        }
      }
    }

    // Planifie la fermeture automatique
    const closeDate = data.closeAt || data.eventDate;
    if (isFutureDate(closeDate)) {
      await scheduleClose({
        eventId: event.id,
        channelId: event.channelId,
        messageId: event.messageId || '',
        guildId: event.guildId,
      }, closeDate);
    }

    // Planifie le résumé post-événement
    const summaryDate = new Date(data.eventDate.getTime() + (data.duration || 0) * 60000 + SUMMARY_DELAY_MINUTES * 60000);
    if (isFutureDate(summaryDate)) {
      await scheduleSummary({
        eventId: event.id,
        guildId: event.guildId,
      }, summaryDate);
    }

    // Crée la récurrence si définie
    if (data.recurrence) {
      const recurrence = await prisma.recurrence.create({
        data: {
          eventId: event.id,
          pattern: data.recurrence.pattern,
          interval: data.recurrence.interval,
          dayOfWeek: data.recurrence.dayOfWeek ?? null,
          endDate: data.recurrence.endDate || null,
          nextRunAt: data.eventDate,
        },
      });

      await scheduleRecurrence({
        eventId: event.id,
        recurrenceId: recurrence.id,
        guildId: event.guildId,
      }, data.eventDate);
    }

    logger.info(`Event created: ${event.title} (${event.id}) in guild ${event.guildId}`);

    return this.getById(event.id) as Promise<EventWithDetails>;
  }

  /**
   * Récupère un événement avec tous ses détails
   */
  static async getById(eventId: string): Promise<EventWithDetails | null> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
        template: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
        reminders: true,
        recurrence: true,
      },
    });

    if (!event) return null;

    return {
      id: event.id,
      guildId: event.guildId,
      templateId: event.templateId,
      channelId: event.channelId,
      messageId: event.messageId,
      creatorId: event.creatorId,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      eventDate: event.eventDate,
      duration: event.duration,
      maxParticipants: event.maxParticipants,
      pingRoleId: event.pingRoleId,
      allowedRoles: event.allowedRoles,
      closeAt: event.closeAt,
      status: event.status,
      summarySent: event.summarySent,
      participants: event.participants.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        optionEmoji: p.optionEmoji,
        optionLabel: p.optionLabel,
        isWaitlisted: p.isWaitlisted,
        waitlistPos: p.waitlistPos,
      })),
      template: event.template
        ? {
            id: event.template.id,
            name: event.template.name,
            options: event.template.options.map((o) => ({
              emoji: o.emoji,
              label: o.label,
              maxSlots: o.maxSlots,
              sortOrder: o.sortOrder,
              category: o.category as 'signup' | 'maybe' | 'decline',
            })),
          }
        : null,
      reminders: event.reminders.map((r) => ({
        id: r.id,
        minutesBefore: r.minutesBefore,
        sent: r.sent,
        scheduledAt: r.scheduledAt,
      })),
      recurrence: event.recurrence
        ? {
            pattern: event.recurrence.pattern,
            interval: event.recurrence.interval,
            dayOfWeek: event.recurrence.dayOfWeek,
            endDate: event.recurrence.endDate,
            nextRunAt: event.recurrence.nextRunAt,
          }
        : null,
    };
  }

  /**
   * Récupère un événement par son messageId Discord
   */
  static async getByMessageId(messageId: string): Promise<EventWithDetails | null> {
    const event = await prisma.event.findUnique({
      where: { messageId },
      select: { id: true },
    });

    if (!event) return null;
    return this.getById(event.id);
  }

  /**
   * Met à jour le messageId d'un événement (après publication de l'embed)
   */
  static async setMessageId(eventId: string, messageId: string): Promise<void> {
    await prisma.event.update({
      where: { id: eventId },
      data: { messageId },
    });
  }

  /**
   * Change le statut d'un événement
   */
  static async updateStatus(eventId: string, status: EventStatus): Promise<void> {
    await prisma.event.update({
      where: { id: eventId },
      data: { status },
    });
    logger.info(`Event ${eventId} status changed to ${status}`);
  }

  /**
   * Ferme les inscriptions d'un événement
   */
  static async closeRegistrations(eventId: string): Promise<void> {
    await this.updateStatus(eventId, EventStatus.CLOSED);
  }

  /**
   * Marque un événement comme terminé
   */
  static async complete(eventId: string): Promise<void> {
    await this.updateStatus(eventId, EventStatus.COMPLETED);
  }

  /**
   * Annule un événement
   */
  static async cancel(eventId: string): Promise<void> {
    await this.updateStatus(eventId, EventStatus.CANCELLED);
  }

  /**
   * Marque le résumé comme envoyé
   */
  static async markSummarySent(eventId: string): Promise<void> {
    await prisma.event.update({
      where: { id: eventId },
      data: { summarySent: true },
    });
  }

  /**
   * Liste les événements avec filtres
   */
  static async list(filters: EventFilters): Promise<EventWithDetails[]> {
    const where: Record<string, unknown> = { guildId: filters.guildId };

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }
    if (filters.creatorId) where.creatorId = filters.creatorId;
    if (filters.channelId) where.channelId = filters.channelId;
    if (filters.fromDate || filters.toDate) {
      where.eventDate = {};
      if (filters.fromDate) (where.eventDate as Record<string, Date>).gte = filters.fromDate;
      if (filters.toDate) (where.eventDate as Record<string, Date>).lte = filters.toDate;
    }

    const events = await prisma.event.findMany({
      where: where as Parameters<typeof prisma.event.findMany>[0] extends { where?: infer W } ? W : never,
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
        template: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
        reminders: true,
        recurrence: true,
      },
      orderBy: { eventDate: 'asc' },
      take: 25,
    });

    return events.map((event) => ({
      id: event.id,
      guildId: event.guildId,
      templateId: event.templateId,
      channelId: event.channelId,
      messageId: event.messageId,
      creatorId: event.creatorId,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      eventDate: event.eventDate,
      duration: event.duration,
      maxParticipants: event.maxParticipants,
      pingRoleId: event.pingRoleId,
      allowedRoles: event.allowedRoles,
      closeAt: event.closeAt,
      status: event.status,
      summarySent: event.summarySent,
      participants: event.participants.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        optionEmoji: p.optionEmoji,
        optionLabel: p.optionLabel,
        isWaitlisted: p.isWaitlisted,
        waitlistPos: p.waitlistPos,
      })),
      template: event.template
        ? {
            id: event.template.id,
            name: event.template.name,
            options: event.template.options.map((o) => ({
              emoji: o.emoji,
              label: o.label,
              maxSlots: o.maxSlots,
              sortOrder: o.sortOrder,
              category: o.category as 'signup' | 'maybe' | 'decline',
            })),
          }
        : null,
      reminders: event.reminders.map((r) => ({
        id: r.id,
        minutesBefore: r.minutesBefore,
        sent: r.sent,
        scheduledAt: r.scheduledAt,
      })),
      recurrence: event.recurrence
        ? {
            pattern: event.recurrence.pattern,
            interval: event.recurrence.interval,
            dayOfWeek: event.recurrence.dayOfWeek,
            endDate: event.recurrence.endDate,
            nextRunAt: event.recurrence.nextRunAt,
          }
        : null,
    }));
  }

  /**
   * Récupère les événements auxquels un utilisateur participe
   */
  static async getEventsForUser(guildId: string, userId: string): Promise<EventWithDetails[]> {
    const participations = await prisma.eventParticipant.findMany({
      where: { userId, event: { guildId, status: { in: [EventStatus.OPEN, EventStatus.SCHEDULED] } } },
      select: { eventId: true },
    });

    const eventIds = participations.map((p) => p.eventId);
    if (eventIds.length === 0) return [];

    const events = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
        template: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
        reminders: true,
        recurrence: true,
      },
      orderBy: { eventDate: 'asc' },
    });

    return events.map((event) => ({
      id: event.id,
      guildId: event.guildId,
      templateId: event.templateId,
      channelId: event.channelId,
      messageId: event.messageId,
      creatorId: event.creatorId,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      eventDate: event.eventDate,
      duration: event.duration,
      maxParticipants: event.maxParticipants,
      pingRoleId: event.pingRoleId,
      allowedRoles: event.allowedRoles,
      closeAt: event.closeAt,
      status: event.status,
      summarySent: event.summarySent,
      participants: event.participants.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        optionEmoji: p.optionEmoji,
        optionLabel: p.optionLabel,
        isWaitlisted: p.isWaitlisted,
        waitlistPos: p.waitlistPos,
      })),
      template: event.template
        ? {
            id: event.template.id,
            name: event.template.name,
            options: event.template.options.map((o) => ({
              emoji: o.emoji,
              label: o.label,
              maxSlots: o.maxSlots,
              sortOrder: o.sortOrder,
              category: o.category as 'signup' | 'maybe' | 'decline',
            })),
          }
        : null,
      reminders: event.reminders.map((r) => ({
        id: r.id,
        minutesBefore: r.minutesBefore,
        sent: r.sent,
        scheduledAt: r.scheduledAt,
      })),
      recurrence: event.recurrence
        ? {
            pattern: event.recurrence.pattern,
            interval: event.recurrence.interval,
            dayOfWeek: event.recurrence.dayOfWeek,
            endDate: event.recurrence.endDate,
            nextRunAt: event.recurrence.nextRunAt,
          }
        : null,
    }));
  }

  /**
   * Supprime un événement
   */
  static async delete(eventId: string): Promise<void> {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new EventNotFoundError(eventId);

    await prisma.event.delete({ where: { id: eventId } });
    logger.info(`Event deleted: ${event.title} (${eventId})`);
  }
}
