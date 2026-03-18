import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  discord: {
    token: requireEnv('DISCORD_TOKEN'),
    clientId: requireEnv('DISCORD_CLIENT_ID'),
  },
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  bot: {
    defaultLocale: process.env.BOT_DEFAULT_LOCALE || 'fr',
    defaultTimezone: process.env.BOT_DEFAULT_TIMEZONE || 'Europe/Paris',
    wizardTimeoutMs: parseInt(process.env.BOT_WIZARD_TIMEOUT_MS || '900000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  nodeEnv: process.env.NODE_ENV || 'production',
} as const;

export type Config = typeof config;
