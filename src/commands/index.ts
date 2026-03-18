import { Collection } from 'discord.js';
import { eventCommand } from './event';
import { eventConfigCommand } from './eventConfig';
import type { BotCommand } from '../types/commands';

export const commands = new Collection<string, BotCommand>();

commands.set('event', eventCommand);
commands.set('eventconfig', eventConfigCommand);

export function getCommandsData() {
  return Array.from(commands.values()).map((cmd) => cmd.data.toJSON());
}
