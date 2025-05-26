export const ERROR_PREFIX = '[RulerError]';

export function createRulerError(message: string, context?: string): Error {
  const fullMessage = context
    ? `${ERROR_PREFIX} ${message} (Context: ${context})`
    : `${ERROR_PREFIX} ${message}`;
  return new Error(fullMessage);
}

export function logVerbose(message: string, isVerbose: boolean): void {
  if (isVerbose) {
    console.log(`[ruler:verbose] ${message}`);
  }
}
