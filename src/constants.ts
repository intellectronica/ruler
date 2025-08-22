export const ERROR_PREFIX = '[ruler]';
// Centralized default rules filename. Now points to 'AGENTS.md'.
// Legacy '.ruler/instructions.md' is still supported as a fallback with a warning.
export const DEFAULT_RULES_FILENAME = 'AGENTS.md';

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
