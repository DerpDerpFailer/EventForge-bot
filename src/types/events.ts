import type { EventStatus } from '@prisma/client';

/**
 * Data required to update an event embed in Discord
 */
export interface EmbedUpdateData {
  eventId: string;
  channelId: string;
  messageId: string;
  guildId: string;
}

/**
 * Données pour la création d'un job de rappel
 */
export interface ReminderJobData {
  eventId: string;
  reminderId: string;
  channelId: string;
  guildId: string;
  minutesBefore: number;
}

/**
 * Données pour la création d'un job de fermeture
 */
export interface CloseJobData {
  eventId: string;
  channelId: string;
  messageId: string;
  guildId: string;
}

/**
 * Données pour le job de résumé
 */
export interface SummaryJobData {
  eventId: string;
  guildId: string;
}

/**
 * Données pour le job de nettoyage
 */
export interface CleanupJobData {
  eventId: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
}

/**
 * Données pour le job de récurrence
 */
export interface RecurrenceJobData {
  eventId: string;
  recurrenceId: string;
  guildId: string;
}

/**
 * Résultat de l'inscription d'un participant
 */
export interface RegistrationResult {
  success: boolean;
  action: 'joined' | 'waitlisted' | 'changed' | 'withdrawn' | 'error';
  message: string;
  isWaitlisted: boolean;
  waitlistPos?: number;
}

/**
 * Filtres pour la liste des événements
 */
export interface EventFilters {
  guildId: string;
  status?: EventStatus | EventStatus[];
  creatorId?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
  channelId?: string;
}
