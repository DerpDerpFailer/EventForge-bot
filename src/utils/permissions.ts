import {
  GuildMember,
  PermissionFlagsBits,
  type Guild as DiscordGuild,
} from 'discord.js';
import { prisma } from '../database/prisma';
import logger from './logger';

/**
 * Vérifie si un membre a les permissions d'administrateur Discord
 */
export function isDiscordAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Vérifie si un membre peut créer des événements sur ce serveur
 * - Admins Discord peuvent toujours créer
 * - Sinon, vérifie les creatorRoles configurés pour la guild
 */
export async function canCreateEvent(
  member: GuildMember,
  guildId: string
): Promise<boolean> {
  if (isDiscordAdmin(member)) return true;

  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { creatorRoles: true },
  });

  // Si aucune config de guild ou pas de rôle créateur défini, tout le monde peut créer
  if (!guild || guild.creatorRoles.length === 0) return true;

  // Vérifie si le membre a un des rôles créateurs
  return guild.creatorRoles.some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Vérifie si un membre peut configurer le bot (admin uniquement)
 */
export function canConfigureBot(member: GuildMember): boolean {
  return isDiscordAdmin(member);
}

/**
 * Vérifie si un utilisateur a un rôle autorisé pour s'inscrire à un événement
 * Si allowedRoles est vide, tout le monde peut s'inscrire
 */
export function canRegisterForEvent(
  member: GuildMember,
  allowedRoles: string[]
): boolean {
  if (allowedRoles.length === 0) return true;
  return allowedRoles.some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Vérifie si un channel est autorisé pour poster des événements
 */
export async function isAllowedChannel(
  guildId: string,
  channelId: string
): Promise<boolean> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { allowedChannels: true },
  });

  // Si aucune restriction, tous les channels sont autorisés
  if (!guild || guild.allowedChannels.length === 0) return true;

  return guild.allowedChannels.includes(channelId);
}

/**
 * Vérifie si l'utilisateur est le créateur de l'événement ou un admin
 */
export async function canManageEvent(
  member: GuildMember,
  eventCreatorId: string
): Promise<boolean> {
  if (isDiscordAdmin(member)) return true;
  return member.id === eventCreatorId;
}

/**
 * Récupère les IDs des channels textuels d'une guild Discord
 */
export async function getTextChannels(
  guild: DiscordGuild
): Promise<Array<{ id: string; name: string }>> {
  try {
    const channels = await guild.channels.fetch();
    return channels
      .filter((ch) => ch !== null && ch.isTextBased() && !ch.isThread())
      .map((ch) => ({ id: ch!.id, name: ch!.name }));
  } catch (error) {
    logger.error('Failed to fetch guild channels', { error });
    return [];
  }
}
