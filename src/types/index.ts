import type { EventStatus, RecurrencePattern } from '@prisma/client';

export type Locale = 'fr' | 'en';

export type OptionCategory = 'signup' | 'maybe' | 'decline';

export interface TemplateOptionData {
  emoji: string;
  label: string;
  maxSlots: number | null;
  sortOrder: number;
  category: OptionCategory;
}

export interface EventCreateData {
  guildId: string;
  channelId: string;
  creatorId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  eventDate: Date;
  duration?: number;
  maxParticipants?: number;
  pingRoleId?: string;
  allowedRoles?: string[];
  closeAt?: Date;
  templateId?: string;
  reminders?: number[];
  recurrence?: {
    pattern: RecurrencePattern;
    interval: number;
    dayOfWeek?: number;
    endDate?: Date;
  };
}

export interface ParticipantInfo {
  userId: string;
  userName: string;
  optionEmoji: string;
  optionLabel: string;
  isWaitlisted: boolean;
  waitlistPos: number | null;
}

export interface EventWithDetails {
  id: string;
  guildId: string;
  templateId: string | null;
  channelId: string;
  messageId: string | null;
  creatorId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  eventDate: Date;
  duration: number | null;
  maxParticipants: number | null;
  pingRoleId: string | null;
  allowedRoles: string[];
  closeAt: Date | null;
  status: EventStatus;
  summarySent: boolean;
  participants: ParticipantInfo[];
  template: {
    id: string;
    name: string;
    options: TemplateOptionData[];
  } | null;
  reminders: Array<{
    id: string;
    minutesBefore: number;
    sent: boolean;
    scheduledAt: Date;
  }>;
  recurrence: {
    pattern: RecurrencePattern;
    interval: number;
    dayOfWeek: number | null;
    endDate: Date | null;
    nextRunAt: Date | null;
  } | null;
}

export interface GuildConfig {
  id: string;
  name: string | null;
  locale: Locale;
  timezone: string;
  defaultReminders: number[];
  summaryChannelId: string | null;
  statsChannelId: string | null;
  allowedChannels: string[];
  creatorRoles: string[];
}

export interface StatsEntry {
  userId: string;
  userName: string;
  attended: number;
  maybe: number;
  declined: number;
  noShow: number;
}
