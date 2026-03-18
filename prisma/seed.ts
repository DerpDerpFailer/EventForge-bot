import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed ne crée pas de guild — les guilds sont créées quand le bot rejoint un serveur.
  // On crée uniquement les templates par défaut qui seront copiés pour chaque nouvelle guild.

  // Template "Simple" — sera clonée pour chaque guild à l'ajout
  // On utilise une guild fictive "_default" pour stocker les templates par défaut
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
  const simpleTemplate = await prisma.template.upsert({
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
  const raidTemplate = await prisma.template.upsert({
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

  console.log(`✅ Created default guild: ${defaultGuild.id}`);
  console.log(`✅ Created template: ${simpleTemplate.name}`);
  console.log(`✅ Created template: ${raidTemplate.name}`);
  console.log('🌱 Seeding complete!');
}

main()
  .catch((error) => {
    console.error('❌ Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
