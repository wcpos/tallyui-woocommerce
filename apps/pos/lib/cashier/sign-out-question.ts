import { toast } from '../toast/toast';

/** v2 switch-confirm.tsx:261-268 (en/core.json:3049-3050): asked only while the register is open or counting. */
export function signOutQuestion(
  register: { enabled: boolean; blind: boolean; registerName: string | null; session: { status: string } | null } | null,
  figure: string | undefined,
): string | undefined {
  if (!register?.enabled || (register.session?.status !== 'open' && register.session?.status !== 'counting')) return undefined;
  const name = register.registerName ?? 'This till';
  return register.blind || !figure ? `${name} is still open. Close it first?` : `${name} is still open at ${figure}. Close it first?`;
}

/** v2 user-sheet.tsx:602-617: the count first, then the register; a refusal says so and keeps the cashier signed in. */
export async function startCountThen(
  register: { session: { status: string } | null; actions: { startCounting(): Promise<unknown> } },
  then: () => void,
): Promise<boolean> {
  try { if (register.session?.status === 'open') await register.actions.startCounting(); }
  catch { toast({ type: 'error', title: 'The count could not start' }); return false; }
  then();
  return true;
}
