import { prisma } from '../database/prisma';
import { TemplateNotFoundError, ValidationError } from '../utils/errors';
import { MAX_TEMPLATE_OPTIONS, MAX_SLOT_SIZE, MIN_SLOT_SIZE, MAX_TEMPLATES_PER_GUILD } from '../config/constants';
import logger from '../utils/logger';
import type { TemplateOptionData } from '../types';

interface TemplateWithOptions {
  id: string;
  guildId: string;
  name: string;
  isDefault: boolean;
  options: TemplateOptionData[];
}

/**
 * Service de gestion des templates d'inscription
 */
export class TemplateService {
  /**
   * Récupère tous les templates d'une guild
   */
  static async getGuildTemplates(guildId: string): Promise<TemplateWithOptions[]> {
    const templates = await prisma.template.findMany({
      where: { guildId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    return templates.map((tpl) => ({
      id: tpl.id,
      guildId: tpl.guildId,
      name: tpl.name,
      isDefault: tpl.isDefault,
      options: tpl.options.map((opt) => ({
        emoji: opt.emoji,
        label: opt.label,
        maxSlots: opt.maxSlots,
        sortOrder: opt.sortOrder,
        category: opt.category as TemplateOptionData['category'],
      })),
    }));
  }

  /**
   * Récupère un template par ID avec ses options
   */
  static async getById(templateId: string): Promise<TemplateWithOptions> {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!template) throw new TemplateNotFoundError(templateId);

    return {
      id: template.id,
      guildId: template.guildId,
      name: template.name,
      isDefault: template.isDefault,
      options: template.options.map((opt) => ({
        emoji: opt.emoji,
        label: opt.label,
        maxSlots: opt.maxSlots,
        sortOrder: opt.sortOrder,
        category: opt.category as TemplateOptionData['category'],
      })),
    };
  }

  /**
   * Crée un nouveau template pour une guild
   */
  static async create(
    guildId: string,
    name: string,
    options: TemplateOptionData[]
  ): Promise<TemplateWithOptions> {
    // Vérifie la limite de templates par guild
    const count = await prisma.template.count({ where: { guildId } });
    if (count >= MAX_TEMPLATES_PER_GUILD) {
      throw new ValidationError(`Maximum ${MAX_TEMPLATES_PER_GUILD} templates per guild.`);
    }

    if (options.length === 0 || options.length > MAX_TEMPLATE_OPTIONS) {
      throw new ValidationError(`A template must have between 1 and ${MAX_TEMPLATE_OPTIONS} options.`);
    }

    // Valide les slots
    for (const opt of options) {
      if (opt.maxSlots !== null && (opt.maxSlots < MIN_SLOT_SIZE || opt.maxSlots > MAX_SLOT_SIZE)) {
        throw new ValidationError(`Max slots must be between ${MIN_SLOT_SIZE} and ${MAX_SLOT_SIZE}.`);
      }
    }

    const template = await prisma.template.create({
      data: {
        guildId,
        name,
        options: {
          create: options.map((opt, index) => ({
            emoji: opt.emoji,
            label: opt.label,
            maxSlots: opt.maxSlots,
            sortOrder: opt.sortOrder ?? index,
            category: opt.category,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    logger.info(`Template created: ${template.name} for guild ${guildId}`);

    return {
      id: template.id,
      guildId: template.guildId,
      name: template.name,
      isDefault: template.isDefault,
      options: template.options.map((opt) => ({
        emoji: opt.emoji,
        label: opt.label,
        maxSlots: opt.maxSlots,
        sortOrder: opt.sortOrder,
        category: opt.category as TemplateOptionData['category'],
      })),
    };
  }

  /**
   * Supprime un template
   */
  static async delete(templateId: string): Promise<void> {
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) throw new TemplateNotFoundError(templateId);

    await prisma.template.delete({ where: { id: templateId } });
    logger.info(`Template deleted: ${template.name} (${templateId})`);
  }

  /**
   * Récupère le template par défaut d'une guild (premier template isDefault=true)
   */
  static async getDefault(guildId: string): Promise<TemplateWithOptions | null> {
    const template = await prisma.template.findFirst({
      where: { guildId, isDefault: true },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!template) return null;

    return {
      id: template.id,
      guildId: template.guildId,
      name: template.name,
      isDefault: template.isDefault,
      options: template.options.map((opt) => ({
        emoji: opt.emoji,
        label: opt.label,
        maxSlots: opt.maxSlots,
        sortOrder: opt.sortOrder,
        category: opt.category as TemplateOptionData['category'],
      })),
    };
  }
}
