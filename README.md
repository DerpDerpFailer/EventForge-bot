# 🗓️ EventForge.bot

Bot Discord de gestion d'événements communautaires, conçu pour les guildes de jeux (MMO, coopératif) et les communautés gaming.

Inspiré du bot Apollo, mais plus flexible et adapté aux besoins des groupes organisés.

## Fonctionnalités

- **Création d'événements** via assistant interactif en DM (14 étapes)
- **Templates d'inscription** configurables (Simple, Raid MMO, custom)
- **Inscription par boutons** Discord avec mise à jour dynamique de l'embed
- **Waitlist FIFO** — promotion automatique quand une place se libère
- **Rappels automatiques** configurables (15min, 1h, 24h, etc.)
- **Résumé post-événement** avec liste des participants
- **Récurrence** (daily, weekly, biweekly, monthly)
- **Statistiques** de participation avec export CSV
- **Multi-serveur** — un seul bot pour plusieurs serveurs Discord
- **Bilingue** — Français et Anglais

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js 20+ / TypeScript |
| Discord | discord.js v14 |
| Base de données | PostgreSQL 16 |
| ORM | Prisma |
| Cache / Jobs | Redis 7 + BullMQ |
| Conteneurisation | Docker + docker-compose |

## Prérequis

- Docker et Docker Compose
- Un bot Discord créé sur le [Developer Portal](https://discord.com/developers/applications)
- Les intents suivants activés : `GUILDS`, `GUILD_MEMBERS`, `GUILD_MESSAGES`, `DIRECT_MESSAGES`, `MESSAGE_CONTENT`

## Démarrage rapide

### 1. Cloner le projet

```bash
git clone https://github.com/VOTRE_USERNAME/eventforge-bot.git
cd eventforge-bot
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Remplir au minimum :
- `DISCORD_TOKEN` — Token du bot Discord
- `DISCORD_CLIENT_ID` — Client ID de l'application Discord

### 3. Lancer avec Docker

```bash
# Production
docker compose up -d

# Avec pgAdmin (dev)
docker compose --profile dev up -d
```

### 4. Déployer les slash commands

```bash
docker compose exec bot npx ts-node src/deploy-commands.ts
```

### 5. Seed des templates par défaut

```bash
docker compose exec bot npx ts-node prisma/seed.ts
```

## Architecture

```
src/
├── commands/           # Slash commands (/event, /event config)
├── interactions/       # Handlers boutons, select menus, modals
├── wizard/             # Assistant de création (14 étapes en DM)
│   └── steps/          # Chaque étape du wizard
├── services/           # Logique métier (9 services)
├── scheduler/          # BullMQ queues + workers
│   └── workers/        # Rappels, fermeture, résumé, nettoyage, récurrence
├── locales/            # Traductions FR/EN
├── database/           # Prisma client + seed
├── config/             # Configuration centralisée
├── utils/              # Logger, permissions, dates, CSV, erreurs
└── types/              # Types TypeScript
```

## Commandes Discord

| Commande | Description |
|----------|-------------|
| `/event` | Menu principal — Créer, Mes événements, Calendrier, Statistiques |
| `/event config` | Configuration admin — Channels, rôles, langue, timezone, templates |

## Services Docker

| Service | Port | Description |
|---------|------|-------------|
| `bot` | — | Bot Discord (pas d'exposition de port) |
| `postgres` | 5432 | Base de données PostgreSQL |
| `redis` | 6379 | Cache et file de jobs |
| `pgadmin` | 5050 | Interface admin DB (profil dev uniquement) |

## Roadmap

- [ ] Score de fiabilité des utilisateurs
- [ ] Statistiques par rôle
- [ ] Team builder automatique
- [ ] Dashboard web
- [ ] Intégration Google Calendar

## Licence

MIT
