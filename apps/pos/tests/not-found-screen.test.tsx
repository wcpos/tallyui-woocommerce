// v2's not-found gate (apps/main/app/+not-found.tsx): an unknown address offers a way back to `/`.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { NotFoundScreen } from '../components/not-found-screen';

const mocks = vi.hoisted(() => ({ router: { replace: vi.fn(), push: vi.fn() } }));

vi.mock('expo-router', () => ({ router: mocks.router, useRouter: () => mocks.router }));

afterEach(() => { cleanup(); mocks.router.replace.mockReset(); mocks.router.push.mockReset(); });

test('the not-found screen shows v2\'s title and line', () => {
  render(<NotFoundScreen />);
  expect(screen.getByTestId('not-found-screen')).not.toBeNull();
  expect(screen.getByTestId('not-found-screen-title').textContent).toBe('This screen doesn\'t exist.');
  expect(screen.getByTestId('not-found-screen-description').textContent).toBe('The address may be out of date.');
});

test('Back to the start replaces to /', () => {
  render(<NotFoundScreen />);
  const button = screen.getByTestId('not-found-screen-primary');
  expect(button.textContent).toBe('Back to the start');
  fireEvent.click(button);
  expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  expect(mocks.router.replace).toHaveBeenCalledWith('/');
  expect(mocks.router.push).not.toHaveBeenCalled();
});
