import { EventStatus } from '@prisma/client';
import { prisma } from '../database/prisma';
import { EventNotFoundError, RegistrationClosedError } from '../utils/errors';
import logger from '../utils/logger';
import type { RegistrationResult } from '../types/events';

/**
 * Service de gestion des inscriptions aux événements
 * Gère les inscriptions, changements, désinscriptions, waitlist et promotions FIFO
 */
export class ParticipationService {
  /**
   * Inscrit ou change l'inscription d'un utilisateur
   */
  static async register(
    eventId: string,
    userId: string,
    userName: string,
    optionEmoji: string,
    optionLabel: string
  ): Promise<RegistrationResult> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        template: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
        participants: { orderBy: { joinedAt: 'asc' } },
      },
    });

    if (!event) throw new EventNotFoundError(eventId);

    // Vérifie si les inscriptions sont ouvertes
    if (event.status !== EventStatus.OPEN && event.status !== EventStatus.SCHEDULED) {
      throw new RegistrationClosedError(eventId);
    }

    // Vérifie si l'utilisateur est déjà inscrit
    const existing = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    // Si l'utilisateur clique sur la même option → le désinscrire
    if (existing && existing.optionEmoji === optionEmoji) {
      return this.withdraw(eventId, userId);
    }

    // Cherche l'option dans le template pour vérifier les slots
    const templateOption = event.template?.options.find(
      (o) => o.emoji === optionEmoji
    );

    // Compte les inscrits actuels pour cette option (non-waitlist)
    const currentForOption = event.participants.filter(
      (p) => p.optionEmoji === optionEmoji && !p.isWaitlisted
    ).length;

    // Vérifie si la catégorie est pleine
    const maxSlots = templateOption?.maxSlots ?? null;
    const isSlotFull = maxSlots !== null && currentForOption >= maxSlots;

    // Vérifie aussi la limite globale
    const totalActive = event.participants.filter((p) => !p.isWaitlisted).length;
    const isGlobalFull = event.maxParticipants !== null && totalActive >= event.maxParticipants;

    const shouldWaitlist = isSlotFull || isGlobalFull;

    if (existing) {
      // L'utilisateur change d'option
      const oldEmoji = existing.optionEmoji;

      if (shouldWaitlist) {
        // Nouvelle catégorie pleine → mettre en waitlist
        const maxWaitlistPos = await this.getMaxWaitlistPos(eventId);
        await prisma.eventParticipant.update({
          where: { id: existing.id },
          data: {
            optionEmoji,
            optionLabel,
            isWaitlisted: true,
            waitlistPos: maxWaitlistPos + 1,
          },
        });

        // Promouvoir quelqu'un de la waitlist pour l'ancienne catégorie si elle était pleine
        await this.promoteFromWaitlist(eventId, oldEmoji);

        return {
          success: true,
          action: 'waitlisted',
          message: optionLabel,
          isWaitlisted: true,
          waitlistPos: maxWaitlistPos + 1,
        };
      }

      // Nouvelle catégorie a de la place
      await prisma.eventParticipant.update({
        where: { id: existing.id },
        data: {
          optionEmoji,
          optionLabel,
          isWaitlisted: false,
          waitlistPos: null,
        },
      });

      // Promouvoir quelqu'un de la waitlist pour l'ancienne catégorie
      await this.promoteFromWaitlist(eventId, oldEmoji);

      return {
        success: true,
        action: 'changed',
        message: optionLabel,
        isWaitlisted: false,
      };
    }

    // Nouvelle inscription
    if (shouldWaitlist) {
      const maxWaitlistPos = await this.getMaxWaitlistPos(eventId);
      await prisma.eventParticipant.create({
        data: {
          eventId,
          userId,
          userName,
          optionEmoji,
          optionLabel,
          isWaitlisted: true,
          waitlistPos: maxWaitlistPos + 1,
        },
      });

      return {
        success: true,
        action: 'waitlisted',
        message: optionLabel,
        isWaitlisted: true,
        waitlistPos: maxWaitlistPos + 1,
      };
    }

    await prisma.eventParticipant.create({
      data: {
        eventId,
        userId,
        userName,
        optionEmoji,
        optionLabel,
        isWaitlisted: false,
        waitlistPos: null,
      },
    });

    return {
      success: true,
      action: 'joined',
      message: optionLabel,
      isWaitlisted: false,
    };
  }

  /**
   * Désinscrit un utilisateur
   */
  static async withdraw(eventId: string, userId: string): Promise<RegistrationResult> {
    const existing = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!existing) {
      return {
        success: false,
        action: 'error',
        message: 'Not registered',
        isWaitlisted: false,
      };
    }

    const oldEmoji = existing.optionEmoji;
    const wasWaitlisted = existing.isWaitlisted;

    await prisma.eventParticipant.delete({
      where: { id: existing.id },
    });

    // Si l'utilisateur n'était pas en waitlist, promouvoir le prochain
    if (!wasWaitlisted) {
      await this.promoteFromWaitlist(eventId, oldEmoji);
    }

    return {
      success: true,
      action: 'withdrawn',
      message: '',
      isWaitlisted: false,
    };
  }

  /**
   * Promotion FIFO: promeut le premier en file d'attente pour une option donnée
   * Retourne l'userId promu, ou null
   */
  static async promoteFromWaitlist(
    eventId: string,
    optionEmoji: string
  ): Promise<string | null> {
    // Cherche le premier en waitlist pour cette option
    const nextInLine = await prisma.eventParticipant.findFirst({
      where: {
        eventId,
        optionEmoji,
        isWaitlisted: true,
      },
      orderBy: { waitlistPos: 'asc' },
    });

    if (!nextInLine) return null;

    // Promeut cet utilisateur
    await prisma.eventParticipant.update({
      where: { id: nextInLine.id },
      data: {
        isWaitlisted: false,
        waitlistPos: null,
      },
    });

    // Réorganise les positions dans la waitlist
    await this.reorderWaitlist(eventId);

    logger.info(`Promoted user ${nextInLine.userId} from waitlist for event ${eventId}`);

    return nextInLine.userId;
  }

  /**
   * Réorganise les positions de la waitlist
   */
  private static async reorderWaitlist(eventId: string): Promise<void> {
    const waitlisted = await prisma.eventParticipant.findMany({
      where: { eventId, isWaitlisted: true },
      orderBy: { waitlistPos: 'asc' },
    });

    for (let i = 0; i < waitlisted.length; i++) {
      if (waitlisted[i].waitlistPos !== i + 1) {
        await prisma.eventParticipant.update({
          where: { id: waitlisted[i].id },
          data: { waitlistPos: i + 1 },
        });
      }
    }
  }

  /**
   * Récupère la position max dans la waitlist
   */
  private static async getMaxWaitlistPos(eventId: string): Promise<number> {
    const result = await prisma.eventParticipant.aggregate({
      where: { eventId, isWaitlisted: true },
      _max: { waitlistPos: true },
    });
    return result._max.waitlistPos ?? 0;
  }

  /**
   * Récupère les participants d'un événement groupés par option
   */
  static async getGroupedParticipants(eventId: string): Promise<
    Map<string, { emoji: string; label: string; participants: Array<{ userId: string; userName: string; isWaitlisted: boolean }> }>
  > {
    const participants = await prisma.eventParticipant.findMany({
      where: { eventId },
      orderBy: [{ isWaitlisted: 'asc' }, { joinedAt: 'asc' }],
    });

    const grouped = new Map<
      string,
      { emoji: string; label: string; participants: Array<{ userId: string; userName: string; isWaitlisted: boolean }> }
    >();

    for (const p of participants) {
      const key = p.optionEmoji;
      if (!grouped.has(key)) {
        grouped.set(key, { emoji: p.optionEmoji, label: p.optionLabel, participants: [] });
      }
      grouped.get(key)!.participants.push({
        userId: p.userId,
        userName: p.userName,
        isWaitlisted: p.isWaitlisted,
      });
    }

    return grouped;
  }

  /**
   * Compte les participants actifs (non-waitlist) d'un événement
   */
  static async countActiveParticipants(eventId: string): Promise<number> {
    return prisma.eventParticipant.count({
      where: { eventId, isWaitlisted: false },
    });
  }

  /**
   * Compte les participants en waitlist d'un événement
   */
  static async countWaitlisted(eventId: string): Promise<number> {
    return prisma.eventParticipant.count({
      where: { eventId, isWaitlisted: true },
    });
  }
}
