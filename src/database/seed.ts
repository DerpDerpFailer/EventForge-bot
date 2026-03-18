/**
 * Re-exports the seed script from prisma/seed.ts
 * This file serves as an alternative entry point accessible from src/
 * The actual seed logic lives in prisma/seed.ts
 *
 * Usage: npx ts-node src/database/seed.ts
 * Or:    npm run db:seed (uses prisma/seed.ts)
 */

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Seed programmatique — peut être appelé depuis le code
 * Crée les templates par défaut pour une guild spécifique
 */
export async function seedGuildDefaults(guildId: string): Promise<void> {
  // Vérifie si la guild a déjà des templates
  const existingCount = await prisma.template.count({ where: { guildId } });
  if (existingCount > 0) {
    logger.info(`Guild ${guildId} already has ${existingCount} templates, skipping seed`);
    return;
  }

  // Copie les templates par défaut
  const defaults = await prisma.template.findMany({
    where: { guildId: '_default', isDefault: true },
    include: { options: true },
  });

  for (const tpl of defaults) {
    await prisma.template.create({
      data: {
        guildId,
        name: tpl.name,
        isDefault: true,
        options: {
          create: tpl.options.map((opt) => ({
            emoji: opt.emoji,
            label: opt.label,
            maxSlots: opt.maxSlots,
            sortOrder: opt.sortOrder,
            category: opt.category,
          })),
        },
      },
    });
  }

  logger.info(`Seeded ${defaults.length} default templates for guild ${guildId}`);
}

/**
 * Exécution standalone du seed
 */
async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // Crée la guild par défaut pour stocker les templates de base
  const defaultGuild = await prisma.guild.upsert({
    where: { id: '_default' },
    update: {},
    create: {
      id: '_default',
      name: 'Default Templates',
      locale: 'fr',
      timezone: 'Europe/Paris',
    },
  });

  // Template Simple
  await prisma.template.upsert({
    where: { guildId_name: { guildId: '_default', name: 'Simple' } },
    update: {},
    create: {
      guildId: '_default',
      name: 'Simple',
      isDefault: true,
      options: {
        create: [
          { emoji: '✅', label: 'Participer', maxSlots: null, sortOrder: 0, category: 'signup' },
          { emoji: '❓', label: 'Peut-être', maxSlots: null, sortOrder: 1, category: 'maybe' },
          { emoji: '❌', label: 'Refuser', maxSlots: null, sortOrder: 2, category: 'decline' },
        ],
      },
    },
  });

  // Template Raid MMO
  await prisma.template.upsert({
    where: { guildId_name: { guildId: '_default', name: 'Raid MMO' } },
    update: {},
    create: {
      guildId: '_default',
      name: 'Raid MMO',
      isDefault: true,
      options: {
        create: [
          { emoji: '🛡️', label: 'Tank', maxSlots: 2, sortOrder: 0, category: 'signup' },
          { emoji: '💚', label: 'Healer', maxSlots: 4, sortOrder: 1, category: 'signup' },
          { emoji: '🏹', label: 'DPS distance', maxSlots: 6, sortOrder: 2, category: 'signup' },
          { emoji: '⚔️', label: 'DPS mêlée', maxSlots: 6, sortOrder: 3, category: 'signup' },
          { emoji: '❓', label: 'Peut-être', maxSlots: null, sortOrder: 4, category: 'maybe' },
          { emoji: '❌', label: 'Refuser', maxSlots: null, sortOrder: 5, category: 'decline' },
        ],
      },
    },
  });

  console.log(`✅ Default guild: ${defaultGuild.id}`);
  console.log('🌱 Seeding complete!');
}

// Run if executed directly
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('❌ Seed error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
