import { Worker, type Job } from 'bullmq';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { config } from '../../config';
import { QUEUE_REMINDERS, EMBED_COLOR_OPEN } from '../../config/constants';
import { prisma } from '../../database/prisma';
import { ReminderService } from '../../services/ReminderService';
import { GuildConfigService } from '../../services/GuildConfigService';
import { ParticipationService } from '../../services/ParticipationService';
import { tWithLocale } from '../../locales';
import { discordTimestamp } from '../../utils/dateUtils';
import logger from '../../utils/logger';
import type { ReminderJobData } from '../../types/events';

/**
 * Worker pour l'envoi des rappels d'événements
 */
export function createReminderWorker(client: Client): Worker {
  const worker = new Worker<ReminderJobData>(
    QUEUE_REMINDERS,
    async (job: Job<ReminderJobData>) => {
      const { eventId, reminderId, channelId, guildId } = job.data;

      logger.info(`Processing reminder ${reminderId} for event ${eventId}`);

      try {
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          include: { participants: true },
        });

        if (!event || event.status === 'CANCELLED' || event.status === 'COMPLETED') {
          logger.info(`Skipping reminder for event ${eventId} (status: ${event?.status || 'not found'})`);
          return;
        }

        const guildConfig = await GuildConfigService.getOrCreate(guildId);
        const locale = guildConfig.locale;

        const activeParticipants = event.participants.filter((p) => !p.isWaitlisted);

        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId) as TextChannel;

        if (!channel || !channel.isTextBased()) {
          logger.warn(`Reminder channel ${channelId} not found`);
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(tWithLocale(locale, 'reminders.title', { title: event.title }))
          .setDescription(tWithLocale(locale, 'reminders.message', {
            title: event.title,
            time: discordTimestamp(event.eventDate, 'R'),
          }))
          .setColor(EMBED_COLOR_OPEN)
          .addFields({
            name: '\u200b',
            value: tWithLocale(locale, 'reminders.participants_count', {
              count: activeParticipants.length,
            }),
          })
          .setTimestamp();

        // Mention des participants inscrits
        const mentions = activeParticipants
          .map((p) => `<@${p.userId}>`)
          .join(' ');

        await channel.send({
          content: mentions || undefined,
          embeds: [embed],
        });

        // Marque le rappel comme envoyé
        await ReminderService.markSent(reminderId);

        logger.info(`Reminder sent for event ${eventId} (${activeParticipants.length} participants mentioned)`);
      } catch (error) {
        logger.error(`Failed to send reminder for event ${eventId}`, { error });
        throw error;
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`Reminder job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Reminder job ${job?.id} failed`, { error: err.message });
  });

  return worker;
}
