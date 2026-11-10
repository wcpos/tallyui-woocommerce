import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';

export type EmailSendFailureKind = 'connectivity' | 'permanent';
export interface EmailSendFailure { kind: EmailSendFailureKind; reason: string; status?: number }

// v2 packages/query/src/receipt-email-queue/classify.ts: retryable HTTP statuses.
const RETRYABLE_STATUSES = new Set([408, 423, 425, 429]);
// v2 packages/query/src/receipt-email-queue/classify.ts: transport failure messages.
const TRANSPORT_MESSAGE = /network error|failed to fetch|load failed|timeout|timed out|offline/i;

export function classifyEmailSendError(error: unknown): EmailSendFailure {
  if (error instanceof ConnectorUnauthorizedError) {
    return { kind: 'permanent', reason: 'Sign in again to send the receipt', status: error.status };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof CustomerServiceError) {
    if (error.code === 'invalid') return { kind: 'permanent', reason: `The store refused the email: ${message}` };
    if (error.code === 'network') return { kind: 'connectivity', reason: 'Could not reach the store' };
    if (error.code === 'server') {
      const match = /^HTTP (\d{3})$/.exec(message);
      if (match) {
        const status = Number(match[1]);
        return status >= 500 || RETRYABLE_STATUSES.has(status)
          ? { kind: 'connectivity', reason: `The store could not send the email (HTTP ${status})`, status }
          : { kind: 'permanent', reason: `The store could not send the email (HTTP ${status}). Send again to retry.`, status };
      }
      if (message === 'unexpected response') return { kind: 'permanent', reason: 'The server did not send the email.' };
      return { kind: 'permanent', reason: `The store could not send the email (${message}). Send again to retry.` };
    }
  }
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
    return { kind: 'connectivity', reason: 'Could not reach the store' };
  }
  if (TRANSPORT_MESSAGE.test(message)) return { kind: 'connectivity', reason: 'Could not reach the store' };
  return { kind: 'permanent', reason: message };
}
