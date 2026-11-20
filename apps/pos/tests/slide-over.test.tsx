import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Text } from 'react-native';
import { PANE, PANEL_SLIDE_OUT, SlideOver } from '../components/slide-over';

// v2 components slide-over/index.tsx: the cover's state machine, staged then landed a frame later, unmounted after the slide out.
const panel = () => screen.getByTestId('cover-panel');
const cover = (open: boolean, onLeft = vi.fn()) => <SlideOver testID="cover" open={open} from="bottom" onLeft={onLeft}><Text>Inside</Text></SlideOver>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('mounted closed, it renders nothing', () => {
  render(cover(false));
  expect(screen.queryByTestId('cover')).toBeNull();
  expect(screen.queryByText('Inside')).toBeNull();
});

test('opened, it renders parked outside its frame, and lands one animation frame later', () => {
  const view = render(cover(false));
  view.rerender(cover(true));
  expect(screen.getByText('Inside')).not.toBeNull();
  expect(panel().style.transform).toBe('translateY(100%)');
  expect(panel().getAttribute('aria-hidden')).toBeNull();
  act(() => { vi.advanceTimersToNextFrame(); });
  expect(panel().style.transform).toBe('translateY(0%)');
  expect(panel().style.transitionDuration).toBe(`${PANE}ms`);
  expect(panel().style.transitionTimingFunction).toBe('cubic-bezier(0.2, 0.7, 0.2, 1)');
});

test('a cover that mounts open is already in place', () => {
  render(cover(true));
  expect(panel().style.transform).toBe('translateY(0%)');
});

test('closed, it stays mounted and aria-hidden until PANEL_SLIDE_OUT has passed, then unmounts and calls onLeft once', () => {
  const onLeft = vi.fn();
  const view = render(cover(true, onLeft));
  view.rerender(cover(false, onLeft));
  expect(panel().getAttribute('aria-hidden')).toBe('true');
  expect(panel().style.transform).toBe('translateY(100%)');
  expect(panel().style.transitionDuration).toBe(`${PANEL_SLIDE_OUT}ms`);
  act(() => { vi.advanceTimersByTime(PANEL_SLIDE_OUT - 1); });
  expect(screen.getByTestId('cover')).not.toBeNull();
  expect(onLeft).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.queryByTestId('cover')).toBeNull();
  expect(onLeft).toHaveBeenCalledOnce();
  act(() => { vi.advanceTimersByTime(PANEL_SLIDE_OUT); });
  expect(onLeft).toHaveBeenCalledOnce();
});

test('a reopen within the slide out keeps it mounted, and onLeft is not called', () => {
  const onLeft = vi.fn();
  const view = render(cover(true, onLeft));
  view.rerender(cover(false, onLeft));
  act(() => { vi.advanceTimersByTime(PANEL_SLIDE_OUT / 2); });
  view.rerender(cover(true, onLeft));
  act(() => { vi.advanceTimersByTime(PANEL_SLIDE_OUT * 2); });
  expect(screen.getByTestId('cover')).not.toBeNull();
  expect(panel().getAttribute('aria-hidden')).toBeNull();
  expect(panel().style.transform).toBe('translateY(0%)');
  expect(onLeft).not.toHaveBeenCalled();
});

test('with reduced motion on, nothing slides and the close unmounts on a 0 ms timer', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
  const onLeft = vi.fn();
  const view = render(cover(true, onLeft));
  expect(panel().style.transitionDuration).toBe('0ms');
  view.rerender(cover(false, onLeft));
  expect(panel().style.transitionDuration).toBe('0ms');
  act(() => { vi.advanceTimersByTime(0); });
  expect(screen.queryByTestId('cover')).toBeNull();
  expect(onLeft).toHaveBeenCalledOnce();
});
