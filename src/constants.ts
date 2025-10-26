export const ERROR_PREFIX = '[ruler]';
// Centralized default rules filename. Now points to 'AGENTS.md'.
// Legacy '.ruler/instructions.md' is still supported as a fallback with a warning.
export const DEFAULT_RULES_FILENAME = 'AGENTS.md';

export function actionPrefix(dry: boolean): string {
  return dry ? '[ruler:dry-run]' : '[ruler]';
}

export function createRulerError(message: string, context?: string): Error {
  const fullMessage = context
    ? `${ERROR_PREFIX} ${message} (Context: ${context})`
    : `${ERROR_PREFIX} ${message}`;
  return new Error(fullMessage);
}

export function logVerbose(message: string, isVerbose: boolean): void {
  if (isVerbose) {
    console.error(`[ruler:verbose] ${message}`);
  }
}

/**
 * Centralized logging functions with consistent output streams and prefixing.
 * - info/verbose go to stdout (user-visible progress)
 * - warn/error go to stderr (problems)
 */

export function logInfo(message: string, dryRun = false): void {
  const prefix = actionPrefix(dryRun);
  console.log(`${prefix} ${message}`);
}

export function logWarn(message: string, dryRun = false): void {
  const prefix = actionPrefix(dryRun);
  console.warn(`${prefix} ${message}`);
}

export function logError(message: string, dryRun = false): void {
  const prefix = actionPrefix(dryRun);
  console.error(`${prefix} ${message}`);
}

export function logVerboseInfo(
  message: string,
  isVerbose: boolean,
  dryRun = false,
): void {
  if (isVerbose) {
    const prefix = actionPrefix(dryRun);
    console.log(`${prefix} ${message}`);
  }
}

// Skills-related constants
export const SKILLS_DIR = 'skills';
export const RULER_SKILLS_PATH = '.ruler/skills';
export const CLAUDE_SKILLS_PATH = '.claude/skills';
export const SKILLZ_DIR = '.skillz';
export const SKILL_MD_FILENAME = 'SKILL.md';
export const SKILLZ_MCP_SERVER_NAME = 'skillz';
