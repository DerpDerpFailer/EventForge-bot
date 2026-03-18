import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
  type Message,
} from 'discord.js';
import { EventStatus } from '@prisma/client';
import { ParticipationService } from './ParticipationService';
import { GuildConfigService } from './GuildConfigService';
import { tWithLocale } from '../locales';
import { formatDate, formatDuration, discordTimestamp } from '../utils/dateUtils';
import {
  EMBED_COLOR_SCHEDULED,
  EMBED_COLOR_OPEN,
  EMBED_COLOR_CLOSED,
  EMBED_COLOR_COMPLETED,
  EMBED_COLOR_CANCELLED,
  CUSTOM_ID,
} from '../config/constants';
import logger from '../utils/logger';
import type { EventWithDetails, Locale } from '../types';

/**
 * Service de construction et mise à jour des embeds Discord pour les événements
 */
export class EmbedService {
  /**
   * Retourne la couleur de l'embed selon le statut
   */
  private static getStatusColor(status: EventStatus): number {
    switch (status) {
      case EventStatus.SCHEDULED: return EMBED_COLOR_SCHEDULED;
      case EventStatus.OPEN: return EMBED_COLOR_OPEN;
      case EventStatus.CLOSED: return EMBED_COLOR_CLOSED;
      case EventStatus.COMPLETED: return EMBED_COLOR_COMPLETED;
      case EventStatus.CANCELLED: return EMBED_COLOR_CANCELLED;
      default: return EMBED_COLOR_SCHEDULED;
    }
  }

  /**
   * Retourne le libellé du statut
   */
  private static getStatusLabel(status: EventStatus, locale: Locale): string {
    const key = `events.embed_${status.toLowerCase()}`;
    return tWithLocale(locale, key);
  }

  /**
   * Construit l'embed complet d'un événement
   */
  static async buildEmbed(event: EventWithDetails): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
    const guildConfig = await GuildConfigService.getOrCreate(event.guildId);
    const locale = guildConfig.locale;
    const timezone = guildConfig.timezone;

    const embed = new EmbedBuilder()
      .setTitle(tWithLocale(locale, 'events.embed_title', { title: event.title }))
      .setColor(this.getStatusColor(event.status))
      .setFooter({ text: tWithLocale(locale, 'events.embed_footer') })
      .setTimestamp(event.eventDate);

    // Description
    const descParts: string[] = [];
    descParts.push(this.getStatusLabel(event.status, locale));
    if (event.description) descParts.push('', event.description);
    embed.setDescription(descParts.join('\n'));

    // Image
    if (event.imageUrl) {
      embed.setImage(event.imageUrl);
    }

    // Date et durée
    embed.addFields({
      name: tWithLocale(locale, 'events.embed_field_date'),
      value: `${discordTimestamp(event.eventDate, 'F')}\n${discordTimestamp(event.eventDate, 'R')}`,
      inline: true,
    });

    if (event.duration) {
      embed.addFields({
        name: tWithLocale(locale, 'events.embed_field_duration'),
        value: formatDuration(event.duration, locale),
        inline: true,
      });
    }

    // Fermeture des inscriptions
    if (event.closeAt) {
      embed.addFields({
        name: tWithLocale(locale, 'events.embed_field_close_date'),
        value: discordTimestamp(event.closeAt, 'R'),
        inline: true,
      });
    }

    // Créateur
    embed.addFields({
      name: tWithLocale(locale, 'events.embed_field_creator'),
      value: `<@${event.creatorId}>`,
      inline: true,
    });

    // Participants groupés par option
    const grouped = await ParticipationService.getGroupedParticipants(event.id);

    if (event.template) {
      for (const option of event.template.options) {
        const group = grouped.get(option.emoji);
        const participants = group?.participants.filter((p) => !p.isWaitlisted) || [];
        const waitlisted = group?.participants.filter((p) => p.isWaitlisted) || [];

        const slotInfo = option.maxSlots
          ? `(${participants.length}/${option.maxSlots})`
          : `(${participants.length})`;

        let value = '';
        if (participants.length === 0 && waitlisted.length === 0) {
          value = tWithLocale(locale, 'events.embed_no_participants');
        } else {
          value = participants.map((p) => p.userName).join('\n') || tWithLocale(locale, 'events.embed_no_participants');
          if (waitlisted.length > 0) {
            value += `\n📋 *${tWithLocale(locale, 'events.embed_waitlist', { count: waitlisted.length })}*`;
          }
        }

        embed.addFields({
          name: `${option.emoji} ${option.label} ${slotInfo}`,
          value,
          inline: true,
        });
      }
    }

    // Nombre total de participants
    const activeCount = event.participants.filter((p) => !p.isWaitlisted).length;
    const totalDisplay = event.maxParticipants
      ? tWithLocale(locale, 'events.embed_participants_count', {
          count: activeCount,
          max: event.maxParticipants,
        })
      : tWithLocale(locale, 'events.embed_participants_unlimited', { count: activeCount });

    embed.addFields({
      name: tWithLocale(locale, 'events.embed_field_participants'),
      value: totalDisplay,
      inline: false,
    });

    // Boutons d'inscription (seulement si OPEN ou SCHEDULED)
    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    if (event.status === EventStatus.OPEN || event.status === EventStatus.SCHEDULED) {
      if (event.template) {
        const rows = this.buildSignupButtons(event.id, event.template.options);
        components.push(...rows);
      }
    }

    return { embed, components };
  }

  /**
   * Construit les boutons d'inscription à partir des options du template
   */
  private static buildSignupButtons(
    eventId: string,
    options: Array<{ emoji: string; label: string; category: string }>
  ): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    let buttonCount = 0;

    for (const option of options) {
      if (buttonCount >= 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
        buttonCount = 0;
      }

      const style = option.category === 'decline'
        ? ButtonStyle.Danger
        : option.category === 'maybe'
          ? ButtonStyle.Secondary
          : ButtonStyle.Success;

      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.EVENT_SIGNUP}:${eventId}:${option.emoji}`)
          .setLabel(option.label)
          .setEmoji(option.emoji)
          .setStyle(style)
      );
      buttonCount++;
    }

    if (buttonCount > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Publie ou met à jour l'embed d'un événement dans un channel
   */
  static async publishOrUpdate(
    channel: TextChannel,
    event: EventWithDetails,
    pingRoleId?: string | null
  ): Promise<Message> {
    const { embed, components } = await this.buildEmbed(event);

    // Contenu pour le ping de rôle
    const content = pingRoleId ? `<@&${pingRoleId}>` : undefined;

    if (event.messageId) {
      // Met à jour le message existant
      try {
        const message = await channel.messages.fetch(event.messageId);
        await message.edit({ embeds: [embed], components });
        return message;
      } catch (error) {
        logger.warn(`Failed to update embed for event ${event.id}, sending new one`, { error });
      }
    }

    // Envoie un nouveau message
    const message = await channel.send({
      content,
      embeds: [embed],
      components,
    });

    return message;
  }

  /**
   * Met à jour l'embed d'un événement (rafraîchit les participants)
   */
  static async refreshEmbed(
    channel: TextChannel,
    event: EventWithDetails
  ): Promise<void> {
    if (!event.messageId) return;

    try {
      const { embed, components } = await this.buildEmbed(event);
      const message = await channel.messages.fetch(event.messageId);
      await message.edit({ embeds: [embed], components });
    } catch (error) {
      logger.error(`Failed to refresh embed for event ${event.id}`, { error });
    }
  }
}
