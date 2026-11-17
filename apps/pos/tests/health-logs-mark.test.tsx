import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import HealthLogs from '../app/health/logs';
import { loadLogsLastViewed } from '../lib/logs/unread-errors';
import { memoryStorage } from './memory-storage';

vi.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <span data-testid="redirect" data-href={href} />,
}));
vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({ ready: true, session: { site: { home: 'https://shop.test', name: 'Shop' } } }),
}));
vi.mock('../lib/catalogue/catalogue-context', () => ({ useCatalogue: () => ({ catalogue: null, error: 'x' }) }));
vi.mock('../lib/sale/outbox-context', () => ({ useOutbox: () => ({ enabled: false }) }));

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("opening the Logs page sets this site's last-viewed mark to now", () => {
  vi.spyOn(Date, 'now').mockReturnValue(7000);
  render(<HealthLogs />);
  expect(loadLogsLastViewed('https://shop.test')).toBe(7000);
});
