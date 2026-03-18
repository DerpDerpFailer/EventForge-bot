/**
 * Constantes globales du bot EventForge
 */

// Limites
export const MAX_TEMPLATE_OPTIONS = 10;
export const MAX_SLOT_SIZE = 20;
export const MIN_SLOT_SIZE = 1;
export const MAX_PARTICIPANTS_LIMIT = 200;
export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_TEMPLATES_PER_GUILD = 20;

// Wizard
export const WIZARD_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const WIZARD_STEP_COUNT = 14;

// Embed
export const EMBED_COLOR_SCHEDULED = 0x3498db; // Bleu
export const EMBED_COLOR_OPEN = 0x2ecc71; // Vert
export const EMBED_COLOR_CLOSED = 0xe74c3c; // Rouge
export const EMBED_COLOR_COMPLETED = 0x95a5a6; // Gris
export const EMBED_COLOR_CANCELLED = 0xe67e22; // Orange

// Durées par défaut pour les rappels (en minutes)
export const DEFAULT_REMINDERS = [15, 60, 1440]; // 15min, 1h, 24h

// Scheduler
export const CLEANUP_DAYS_AFTER_EVENT = 30;
export const SUMMARY_DELAY_MINUTES = 30; // Envoi du résumé X min après la fin

// BullMQ Queue names
export const QUEUE_REMINDERS = 'event-reminders';
export const QUEUE_CLOSE = 'event-close';
export const QUEUE_CLEANUP = 'event-cleanup';
export const QUEUE_SUMMARY = 'event-summary';
export const QUEUE_RECURRENCE = 'event-recurrence';

// Custom IDs prefixes for interactions
export const CUSTOM_ID = {
  // Boutons événement
  EVENT_SIGNUP: 'evt_signup',
  EVENT_WITHDRAW: 'evt_withdraw',

  // Wizard steps
  WIZARD_PREFIX: 'wiz',
  WIZARD_NEXT: 'wiz_next',
  WIZARD_PREV: 'wiz_prev',
  WIZARD_CANCEL: 'wiz_cancel',
  WIZARD_SKIP: 'wiz_skip',
  WIZARD_CONFIRM: 'wiz_confirm',
  WIZARD_EDIT: 'wiz_edit',
  WIZARD_MODAL: 'wiz_modal',
  WIZARD_SELECT: 'wiz_select',

  // Menu principal /event
  EVENT_MENU: 'event_menu',
  EVENT_CREATE: 'event_create',
  EVENT_MY_EVENTS: 'event_my',
  EVENT_CALENDAR: 'event_calendar',
  EVENT_STATS: 'event_stats',

  // Config
  CONFIG_MENU: 'config_menu',
  CONFIG_CHANNELS: 'config_channels',
  CONFIG_ROLES: 'config_roles',
  CONFIG_STATS_CHANNEL: 'config_stats_ch',
  CONFIG_REMINDERS: 'config_reminders',
  CONFIG_TIMEZONE: 'config_timezone',
  CONFIG_LOCALE: 'config_locale',
  CONFIG_TEMPLATES: 'config_templates',
  CONFIG_MODAL: 'config_modal',
} as const;

// Catégories d'options de template
export const OPTION_CATEGORIES = {
  SIGNUP: 'signup',
  MAYBE: 'maybe',
  DECLINE: 'decline',
} as const;

// Durées prédéfinies (en minutes)
export const DURATION_CHOICES = [
  { label: '30 min', value: 30 },
  { label: '1h', value: 60 },
  { label: '1h30', value: 90 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
  { label: '4h', value: 240 },
  { label: '6h', value: 360 },
  { label: '8h', value: 480 },
] as const;

// Patterns de récurrence
export const RECURRENCE_PATTERNS = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
