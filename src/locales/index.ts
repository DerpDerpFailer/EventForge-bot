import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../database/prisma';
import { config } from '../config';
import logger from '../utils/logger';
import type { Locale } from '../types';

type TranslationData = Record<string, unknown>;

const translations: Record<string, TranslationData> = {};

/**
 * Charge les fichiers de traduction
 */
export function loadLocales(): void {
  const localesDir = join(__dirname);

  for (const locale of ['fr', 'en']) {
    try {
      const filePath = join(localesDir, `${locale}.json`);
      const data = readFileSync(filePath, 'utf-8');
      translations[locale] = JSON.parse(data);
      logger.info(`Loaded locale: ${locale}`);
    } catch (error) {
      logger.error(`Failed to load locale: ${locale}`, { error });
    }
  }
}

/**
 * Cache de la locale par guild pour éviter les requêtes DB à chaque appel
 */
const localeCache = new Map<string, { locale: Locale; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère la locale d'une guild (avec cache)
 */
async function getGuildLocale(guildId: string): Promise<Locale> {
  const cached = localeCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.locale;
  }

  try {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { locale: true },
    });

    const locale = (guild?.locale as Locale) || (config.bot.defaultLocale as Locale);
    localeCache.set(guildId, { locale, expiresAt: Date.now() + CACHE_TTL });
    return locale;
  } catch {
    return config.bot.defaultLocale as Locale;
  }
}

/**
 * Invalide le cache de locale pour une guild
 */
export function invalidateLocaleCache(guildId: string): void {
  localeCache.delete(guildId);
}

/**
 * Résout une clé de traduction depuis les données
 */
function resolveKey(data: TranslationData, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Remplace les paramètres {key} dans un string
 */
function interpolate(
  str: string,
  params?: Record<string, string | number>
): string {
  if (!params) return str;

  return str.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

/**
 * Fonction de traduction principale
 * Utilise la locale de la guild, avec fallback sur le français
 */
export async function t(
  guildId: string,
  key: string,
  params?: Record<string, string | number>
): Promise<string> {
  const locale = await getGuildLocale(guildId);
  return tWithLocale(locale, key, params);
}

/**
 * Traduction synchrone avec locale explicite
 */
export function tWithLocale(
  locale: Locale | string,
  key: string,
  params?: Record<string, string | number>
): string {
  const data = translations[locale] || translations['fr'];
  if (!data) {
    logger.warn(`No translations loaded for locale: ${locale}`);
    return key;
  }

  const resolved = resolveKey(data, key);
  if (!resolved) {
    // Fallback vers le français
    if (locale !== 'fr') {
      const frData = translations['fr'];
      if (frData) {
        const frResolved = resolveKey(frData, key);
        if (frResolved) return interpolate(frResolved, params);
      }
    }
    logger.warn(`Missing translation key: ${key} (locale: ${locale})`);
    return key;
  }

  return interpolate(resolved, params);
}
