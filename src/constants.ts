export const ERROR_PREFIX = '[ruler]';
// Centralized default rules filename. Initially points to legacy 'instructions.md'.
// Future tasks will flip this to 'AGENTS.md' while preserving backward compatibility.
export const DEFAULT_RULES_FILENAME = 'instructions.md';

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
