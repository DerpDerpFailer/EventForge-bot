import {
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type Client,
  type DMChannel,
} from 'discord.js';
import { WizardSession, createSession, getSession, deleteSession } from './WizardSession';
import { WIZARD_STEPS, type WizardStepName } from './types';
import { GuildConfigService } from '../services/GuildConfigService';
import { EventService } from '../services/EventService';
import { EmbedService } from '../services/EmbedService';
import { tWithLocale } from '../locales';
import logger from '../utils/logger';

// Import des steps
import { sendChannelSelectStep, handleChannelSelectInteraction } from './steps/channelSelect';
import { sendTitleStep, handleTitleInteraction } from './steps/title';
import { sendDescriptionStep, handleDescriptionInteraction } from './steps/description';
import { sendDateTimeStep, handleDateTimeInteraction } from './steps/dateTime';
import { sendDurationStep, handleDurationInteraction } from './steps/duration';
import { sendImageStep, handleImageInteraction } from './steps/image';
import { sendTemplateStep, handleTemplateInteraction } from './steps/template';
import { sendMaxParticipantsStep, handleMaxParticipantsInteraction } from './steps/maxParticipants';
import { sendPingRoleStep, handlePingRoleInteraction } from './steps/pingRole';
import { sendAllowedRolesStep, handleAllowedRolesInteraction } from './steps/allowedRoles';
import { sendCloseDateStep, handleCloseDateInteraction } from './steps/closeDate';
import { sendRemindersStep, handleRemindersInteraction } from './steps/reminders';
import { sendRecurrenceStep, handleRecurrenceInteraction } from './steps/recurrence';
import { sendPreviewStep, handlePreviewInteraction } from './steps/preview';
import type { TextChannel } from 'discord.js';

type StepSender = (session: WizardSession, client: Client) => Promise<void>;
type StepHandler = (
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession,
  client: Client
) => Promise<void>;

const stepSenders: Record<WizardStepName, StepSender> = {
  channelSelect: sendChannelSelectStep,
  title: sendTitleStep,
  description: sendDescriptionStep,
  dateTime: sendDateTimeStep,
  duration: sendDurationStep,
  image: sendImageStep,
  template: sendTemplateStep,
  maxParticipants: sendMaxParticipantsStep,
  pingRole: sendPingRoleStep,
  allowedRoles: sendAllowedRolesStep,
  closeDate: sendCloseDateStep,
  reminders: sendRemindersStep,
  recurrence: sendRecurrenceStep,
  preview: sendPreviewStep,
};

const stepHandlers: Record<WizardStepName, StepHandler> = {
  channelSelect: handleChannelSelectInteraction,
  title: handleTitleInteraction,
  description: handleDescriptionInteraction,
  dateTime: handleDateTimeInteraction,
  duration: handleDurationInteraction,
  image: handleImageInteraction,
  template: handleTemplateInteraction,
  maxParticipants: handleMaxParticipantsInteraction,
  pingRole: handlePingRoleInteraction,
  allowedRoles: handleAllowedRolesInteraction,
  closeDate: handleCloseDateInteraction,
  reminders: handleRemindersInteraction,
  recurrence: handleRecurrenceInteraction,
  preview: handlePreviewInteraction,
};

/**
 * Démarre le wizard de création d'événement en DM
 */
export async function startWizard(
  userId: string,
  guildId: string,
  client: Client
): Promise<DMChannel | null> {
  const guildConfig = await GuildConfigService.getOrCreate(guildId);

  const session = createSession(
    userId,
    guildId,
    guildConfig.locale,
    guildConfig.timezone
  );

  // Ouvre le DM
  try {
    const user = await client.users.fetch(userId);
    const dmChannel = await user.createDM();
    session.dmChannel = dmChannel;

    // Configure le timeout
    session.resetTimeout(() => handleTimeout(session));

    // Envoie le premier step
    await sendCurrentStep(session, client);

    return dmChannel;
  } catch (error) {
    logger.error(`Failed to start wizard for user ${userId}`, { error });
    deleteSession(userId);
    return null;
  }
}

/**
 * Envoie le step courant
 */
export async function sendCurrentStep(
  session: WizardSession,
  client: Client
): Promise<void> {
  const sender = stepSenders[session.currentStep];
  if (sender) {
    await sender(session, client);
    session.resetTimeout(() => handleTimeout(session));
  }
}

/**
 * Gère une interaction du wizard (bouton, select menu, modal)
 */
export async function handleWizardInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  client: Client
): Promise<void> {
  const session = getSession(interaction.user.id);
  if (!session) {
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: '❌ No active wizard session. Please start a new one with /event.',
        ephemeral: true,
      });
    }
    return;
  }

  // Gère les actions communes
  const customId = interaction.customId;

  if (customId === 'wiz_cancel') {
    await handleCancel(interaction, session);
    return;
  }

  if (customId === 'wiz_prev') {
    session.prevStep();
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }
    await sendCurrentStep(session, client);
    return;
  }

  // Délègue au handler du step courant
  const handler = stepHandlers[session.currentStep];
  if (handler) {
    await handler(interaction, session, client);
  }
}

/**
 * Gère l'annulation du wizard
 */
async function handleCancel(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  session: WizardSession
): Promise<void> {
  const locale = session.locale;
  deleteSession(session.userId);

  if ('update' in interaction && typeof interaction.update === 'function' && !interaction.replied && !interaction.deferred) {
    await interaction.update({
      content: tWithLocale(locale, 'wizard.cancelled'),
      embeds: [],
      components: [],
    });
  } else if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: tWithLocale(locale, 'wizard.cancelled'),
      ephemeral: true,
    });
  }
}

/**
 * Gère le timeout du wizard
 */
async function handleTimeout(session: WizardSession): Promise<void> {
  const locale = session.locale;

  if (session.dmChannel) {
    try {
      await session.dmChannel.send({
        content: tWithLocale(locale, 'wizard.timeout'),
      });
    } catch {
      // DM peut ne pas être accessible
    }
  }

  deleteSession(session.userId);
}

/**
 * Finalise le wizard: crée l'événement et publie l'embed
 */
export async function finalizeWizard(
  session: WizardSession,
  client: Client
): Promise<void> {
  const { data } = session;

  if (!data.channelId || !data.title || !data.dateTime) {
    logger.error('Wizard finalization failed: missing required data');
    return;
  }

  try {
    // Crée l'événement
    const event = await EventService.create({
      guildId: session.guildId,
      channelId: data.channelId,
      creatorId: session.userId,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      eventDate: data.dateTime,
      duration: data.duration,
      maxParticipants: data.maxParticipants,
      pingRoleId: data.pingRoleId,
      allowedRoles: data.allowedRoles,
      closeAt: data.closeAt,
      templateId: data.templateId,
      reminders: data.reminders,
      recurrence: data.recurrencePattern
        ? {
            pattern: data.recurrencePattern,
            interval: data.recurrenceInterval || 1,
            dayOfWeek: data.recurrenceDayOfWeek,
            endDate: data.recurrenceEndDate,
          }
        : undefined,
    });

    // Publie l'embed dans le channel
    const guild = await client.guilds.fetch(session.guildId);
    const channel = (await guild.channels.fetch(data.channelId)) as TextChannel;

    if (channel && channel.isTextBased()) {
      const message = await EmbedService.publishOrUpdate(
        channel,
        event,
        data.pingRoleId
      );

      // Sauvegarde le messageId
      await EventService.setMessageId(event.id, message.id);
    }

    // Envoie le message de succès en DM
    if (session.dmChannel) {
      await session.dmChannel.send({
        content: tWithLocale(session.locale, 'wizard.success_description', {
          title: data.title,
          channel: `<#${data.channelId}>`,
        }),
      });
    }

    logger.info(`Wizard completed: event ${event.id} created by ${session.userId}`);
  } catch (error) {
    logger.error('Wizard finalization error', { error });
    if (session.dmChannel) {
      await session.dmChannel.send({
        content: tWithLocale(session.locale, 'errors.generic'),
      });
    }
  } finally {
    deleteSession(session.userId);
  }
}
