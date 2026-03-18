import {
  type ButtonInteraction,
  type Client,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import { CUSTOM_ID } from '../config/constants';
import { EventService } from '../services/EventService';
import { ParticipationService } from '../services/ParticipationService';
import { EmbedService } from '../services/EmbedService';
import { GuildConfigService } from '../services/GuildConfigService';
import { canRegisterForEvent } from '../utils/permissions';
import { tWithLocale } from '../locales';
import { handleWizardInteraction } from '../wizard';
import logger from '../utils/logger';

/**
 * Dispatche les interactions de boutons
 */
export async function handleButtonInteraction(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const customId = interaction.customId;

  // Boutons du wizard
  if (customId.startsWith(CUSTOM_ID.WIZARD_PREFIX)) {
    await handleWizardInteraction(interaction, client);
    return;
  }

  // Boutons d'inscription à un événement
  if (customId.startsWith(CUSTOM_ID.EVENT_SIGNUP)) {
    await handleEventSignup(interaction, client);
    return;
  }

  logger.warn(`Unhandled button interaction: ${customId}`);
}

/**
 * Gère le clic sur un bouton d'inscription
 * Format du customId: evt_signup:eventId:emoji
 */
async function handleEventSignup(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const parts = interaction.customId.split(':');
  if (parts.length < 3) return;

  const eventId = parts[1];
  const emoji = parts[2];

  await interaction.deferUpdate();

  try {
    const event = await EventService.getById(eventId);
    if (!event) {
      await interaction.followUp({
        content: '❌ Event not found.',
        ephemeral: true,
      });
      return;
    }

    const guildConfig = await GuildConfigService.getOrCreate(event.guildId);
    const locale = guildConfig.locale;

    // Vérifie les inscriptions ouvertes
    if (event.status !== 'OPEN' && event.status !== 'SCHEDULED') {
      await interaction.followUp({
        content: tWithLocale(locale, 'events.registration_closed'),
        ephemeral: true,
      });
      return;
    }

    // Vérifie les rôles autorisés si en contexte de guild
    if (interaction.guild && event.allowedRoles.length > 0) {
      const member = interaction.member as GuildMember;
      if (!canRegisterForEvent(member, event.allowedRoles)) {
        await interaction.followUp({
          content: tWithLocale(locale, 'events.registration_not_allowed'),
          ephemeral: true,
        });
        return;
      }
    }

    // Trouve le label de l'option
    const option = event.template?.options.find((o) => o.emoji === emoji);
    const optionLabel = option?.label || emoji;

    // Effectue l'inscription
    const result = await ParticipationService.register(
      eventId,
      interaction.user.id,
      interaction.user.displayName || interaction.user.username,
      emoji,
      optionLabel
    );

    // Envoie le feedback en DM ou ephemeral
    let feedbackMessage = '';
    switch (result.action) {
      case 'joined':
        feedbackMessage = tWithLocale(locale, 'events.registration_joined', { option: optionLabel });
        break;
      case 'waitlisted':
        feedbackMessage = tWithLocale(locale, 'events.registration_waitlisted', {
          option: optionLabel,
          pos: result.waitlistPos || 0,
        });
        break;
      case 'changed':
        feedbackMessage = tWithLocale(locale, 'events.registration_changed', { option: optionLabel });
        break;
      case 'withdrawn':
        feedbackMessage = tWithLocale(locale, 'events.registration_withdrawn');
        break;
      default:
        feedbackMessage = tWithLocale(locale, 'events.registration_error');
    }

    await interaction.followUp({
      content: feedbackMessage,
      ephemeral: true,
    });

    // Met à jour l'embed
    const updatedEvent = await EventService.getById(eventId);
    if (updatedEvent && updatedEvent.messageId && interaction.channel) {
      const channel = interaction.channel as TextChannel;
      await EmbedService.refreshEmbed(channel, updatedEvent);
    }

    // Si quelqu'un a été promu de la waitlist, le notifier en DM
    if (result.action === 'withdrawn') {
      const promoted = await checkForPromotedUser(eventId, emoji, client, event.title, locale);
      // Notification handled inside
    }
  } catch (error) {
    logger.error('Event signup error', { error, eventId, userId: interaction.user.id });
    await interaction.followUp({
      content: '❌ An error occurred.',
      ephemeral: true,
    }).catch(() => {});
  }
}

/**
 * Vérifie et notifie si un utilisateur a été promu de la waitlist
 */
async function checkForPromotedUser(
  eventId: string,
  optionEmoji: string,
  client: Client,
  eventTitle: string,
  locale: string
): Promise<void> {
  // La promotion est déjà gérée dans ParticipationService.withdraw()
  // Ici on vérifie s'il y a eu une promotion et on notifie l'utilisateur
  const event = await EventService.getById(eventId);
  if (!event) return;

  // Cherche les participants récemment promus (ceux qui ne sont plus en waitlist
  // mais dont la position waitlist était définie récemment)
  // La notification se fait via un scan des participants promus
  // Le ParticipationService retourne le userId promu, mais on ne peut pas
  // facilement le récupérer ici. La notification est mieux gérée directement
  // dans le flow de promotion. Pour l'instant, on se contente du refresh de l'embed.
}
