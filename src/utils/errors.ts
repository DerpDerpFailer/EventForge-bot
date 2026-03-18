/**
 * Custom error classes for EventForge bot.
 */

export class EventForgeError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'EventForgeError';
    this.code = code;
  }
}

// Erreur quand un événement n'est pas trouvé
export class EventNotFoundError extends EventForgeError {
  constructor(eventId: string) {
    super(`Event not found: ${eventId}`, 'EVENT_NOT_FOUND');
    this.name = 'EventNotFoundError';
  }
}

// Erreur quand l'utilisateur n'a pas les permissions
export class PermissionError extends EventForgeError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'PERMISSION_DENIED');
    this.name = 'PermissionError';
  }
}

// Erreur quand les inscriptions sont fermées
export class RegistrationClosedError extends EventForgeError {
  constructor(eventId: string) {
    super(`Registrations closed for event: ${eventId}`, 'REGISTRATION_CLOSED');
    this.name = 'RegistrationClosedError';
  }
}

// Erreur quand le template n'est pas trouvé
export class TemplateNotFoundError extends EventForgeError {
  constructor(templateId: string) {
    super(`Template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND');
    this.name = 'TemplateNotFoundError';
  }
}

// Erreur quand la guild n'est pas configurée
export class GuildNotConfiguredError extends EventForgeError {
  constructor(guildId: string) {
    super(`Guild not configured: ${guildId}`, 'GUILD_NOT_CONFIGURED');
    this.name = 'GuildNotConfiguredError';
  }
}

// Erreur de validation de données d'entrée
export class ValidationError extends EventForgeError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// Erreur liée au wizard
export class WizardError extends EventForgeError {
  constructor(message: string) {
    super(message, 'WIZARD_ERROR');
    this.name = 'WizardError';
  }
}

// Erreur quand la catégorie/option est pleine
export class SlotFullError extends EventForgeError {
  constructor(optionLabel: string) {
    super(`No available slots for: ${optionLabel}`, 'SLOT_FULL');
    this.name = 'SlotFullError';
  }
}
