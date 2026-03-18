import type { RecurrencePattern } from '@prisma/client';

export type WizardStepName =
  | 'channelSelect'
  | 'title'
  | 'description'
  | 'dateTime'
  | 'duration'
  | 'image'
  | 'template'
  | 'maxParticipants'
  | 'pingRole'
  | 'allowedRoles'
  | 'closeDate'
  | 'reminders'
  | 'recurrence'
  | 'preview';

export const WIZARD_STEPS: WizardStepName[] = [
  'channelSelect',
  'title',
  'description',
  'dateTime',
  'duration',
  'image',
  'template',
  'maxParticipants',
  'pingRole',
  'allowedRoles',
  'closeDate',
  'reminders',
  'recurrence',
  'preview',
];

export interface WizardData {
  guildId: string;
  channelId?: string;
  channelName?: string;
  title?: string;
  description?: string;
  dateTime?: Date;
  duration?: number;
  imageUrl?: string;
  templateId?: string;
  templateName?: string;
  maxParticipants?: number;
  pingRoleId?: string;
  pingRoleName?: string;
  allowedRoles?: string[];
  allowedRoleNames?: string[];
  closeAt?: Date;
  reminders?: number[];
  recurrencePattern?: RecurrencePattern;
  recurrenceInterval?: number;
  recurrenceDayOfWeek?: number;
  recurrenceEndDate?: Date;
}

export interface WizardStepResult {
  action: 'next' | 'prev' | 'cancel' | 'skip' | 'confirm' | 'wait';
  data?: Partial<WizardData>;
}
