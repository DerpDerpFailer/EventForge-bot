import { format, parse, addMinutes, addDays, addWeeks, addMonths, isBefore, isAfter, differenceInMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { fr, enUS, type Locale } from 'date-fns/locale';

const LOCALE_MAP: Record<string, Locale> = {
  fr: fr,
  en: enUS,
};

/**
 * Formate une date dans le timezone et la locale donnés
 */
export function formatDate(
  date: Date,
  timezone: string,
  locale: string,
  formatStr = "EEEE d MMMM yyyy 'à' HH:mm"
): string {
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, formatStr, {
    locale: LOCALE_MAP[locale] || fr,
  });
}

/**
 * Formate une date en format court
 */
export function formatShortDate(
  date: Date,
  timezone: string,
  locale: string
): string {
  return formatDate(date, timezone, locale, 'dd/MM/yyyy HH:mm');
}

/**
 * Formate une durée en minutes en texte lisible
 */
export function formatDuration(minutes: number, locale: string): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (locale === 'fr') {
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  }

  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

/**
 * Parse une date depuis un string au format JJ/MM/AAAA HH:MM dans un timezone donné
 */
export function parseDateTime(
  dateStr: string,
  timezone: string
): Date | null {
  try {
    const parsed = parse(dateStr.trim(), 'dd/MM/yyyy HH:mm', new Date());
    if (isNaN(parsed.getTime())) return null;
    return fromZonedTime(parsed, timezone);
  } catch {
    return null;
  }
}

/**
 * Parse une date format JJ/MM/AAAA
 */
export function parseDateOnly(
  dateStr: string,
  timezone: string
): Date | null {
  try {
    const parsed = parse(dateStr.trim(), 'dd/MM/yyyy', new Date());
    if (isNaN(parsed.getTime())) return null;
    return fromZonedTime(parsed, timezone);
  } catch {
    return null;
  }
}

/**
 * Vérifie si une date est dans le futur
 */
export function isFutureDate(date: Date): boolean {
  return isAfter(date, new Date());
}

/**
 * Vérifie si une date est dans le passé
 */
export function isPastDate(date: Date): boolean {
  return isBefore(date, new Date());
}

/**
 * Calcule la date de rappel (event date - minutes)
 */
export function getReminderDate(eventDate: Date, minutesBefore: number): Date {
  return addMinutes(eventDate, -minutesBefore);
}

/**
 * Calcule la prochaine occurrence selon le pattern de récurrence
 */
export function getNextOccurrence(
  currentDate: Date,
  pattern: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
  interval: number
): Date {
  switch (pattern) {
    case 'DAILY':
      return addDays(currentDate, interval);
    case 'WEEKLY':
      return addWeeks(currentDate, interval);
    case 'BIWEEKLY':
      return addWeeks(currentDate, 2 * interval);
    case 'MONTHLY':
      return addMonths(currentDate, interval);
    default:
      return addWeeks(currentDate, interval);
  }
}

/**
 * Retourne le Discord timestamp format pour affichage dynamique
 */
export function discordTimestamp(date: Date, style: 'R' | 'F' | 'f' | 'd' | 'D' | 't' | 'T' = 'F'): string {
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:${style}>`;
}

/**
 * Retourne la différence en minutes entre deux dates
 */
export function minutesBetween(dateA: Date, dateB: Date): number {
  return differenceInMinutes(dateA, dateB);
}

/**
 * Valide un format de timezone IANA
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
