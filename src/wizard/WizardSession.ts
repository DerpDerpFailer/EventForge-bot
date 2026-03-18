import type { DMChannel, User } from 'discord.js';
import type { WizardData, WizardStepName } from './types';
import { WIZARD_STEPS } from './types';
import { WIZARD_TIMEOUT_MS } from '../config/constants';
import logger from '../utils/logger';

/**
 * Session de wizard stockée en mémoire.
 * Gère l'état courant de la création d'événement pour un utilisateur.
 */
export class WizardSession {
  public readonly userId: string;
  public readonly guildId: string;
  public readonly locale: string;
  public readonly timezone: string;
  public data: WizardData;
  public currentStepIndex: number;
  public dmChannel: DMChannel | null;
  public lastMessageId: string | null;
  private timeoutHandle: NodeJS.Timeout | null;
  private onTimeout: (() => void) | null;

  constructor(
    userId: string,
    guildId: string,
    locale: string,
    timezone: string
  ) {
    this.userId = userId;
    this.guildId = guildId;
    this.locale = locale;
    this.timezone = timezone;
    this.data = { guildId };
    this.currentStepIndex = 0;
    this.dmChannel = null;
    this.lastMessageId = null;
    this.timeoutHandle = null;
    this.onTimeout = null;
  }

  get currentStep(): WizardStepName {
    return WIZARD_STEPS[this.currentStepIndex];
  }

  get isFirstStep(): boolean {
    return this.currentStepIndex === 0;
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === WIZARD_STEPS.length - 1;
  }

  get stepNumber(): number {
    return this.currentStepIndex + 1;
  }

  get totalSteps(): number {
    return WIZARD_STEPS.length;
  }

  /**
   * Avance au step suivant
   */
  nextStep(): void {
    if (!this.isLastStep) {
      this.currentStepIndex++;
    }
  }

  /**
   * Retourne au step précédent
   */
  prevStep(): void {
    if (!this.isFirstStep) {
      this.currentStepIndex--;
    }
  }

  /**
   * Va à un step spécifique
   */
  goToStep(stepName: WizardStepName): void {
    const index = WIZARD_STEPS.indexOf(stepName);
    if (index >= 0) {
      this.currentStepIndex = index;
    }
  }

  /**
   * Met à jour les données du wizard
   */
  updateData(partial: Partial<WizardData>): void {
    this.data = { ...this.data, ...partial };
  }

  /**
   * Réinitialise le timeout d'inactivité
   */
  resetTimeout(callback: () => void): void {
    this.clearTimeout();
    this.onTimeout = callback;
    this.timeoutHandle = setTimeout(() => {
      logger.info(`Wizard session timed out for user ${this.userId}`);
      callback();
    }, WIZARD_TIMEOUT_MS);
  }

  /**
   * Annule le timeout
   */
  clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * Nettoie la session
   */
  destroy(): void {
    this.clearTimeout();
  }
}

/**
 * Stockage en mémoire des sessions wizard
 * Clé: userId
 */
export const wizardSessions = new Map<string, WizardSession>();

/**
 * Récupère ou crée une session wizard
 */
export function getSession(userId: string): WizardSession | undefined {
  return wizardSessions.get(userId);
}

/**
 * Supprime une session wizard
 */
export function deleteSession(userId: string): void {
  const session = wizardSessions.get(userId);
  if (session) {
    session.destroy();
    wizardSessions.delete(userId);
  }
}

/**
 * Crée une nouvelle session wizard
 */
export function createSession(
  userId: string,
  guildId: string,
  locale: string,
  timezone: string
): WizardSession {
  // Supprime l'ancienne session si elle existe
  deleteSession(userId);

  const session = new WizardSession(userId, guildId, locale, timezone);
  wizardSessions.set(userId, session);
  return session;
}
