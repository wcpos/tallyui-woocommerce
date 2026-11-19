import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Text } from 'react-native';
import { usePointer } from '../lib/layout/pointer';
import { stubMatchMedia } from './match-media';

afterEach(() => { cleanup(); });

function Probe() {
  return <Text testID="pointer">{usePointer()}</Text>;
}
const pointer = () => screen.getByTestId('pointer').textContent;

test('usePointer is fine when (pointer: fine) and (hover: hover) both match', () => {
  stubMatchMedia({ '(pointer: fine)': true, '(hover: hover)': true });
  render(<Probe />);
  expect(pointer()).toBe('fine');
});

test('usePointer is coarse when (pointer: fine) fails', () => {
  stubMatchMedia({ '(pointer: fine)': false, '(hover: hover)': true });
  render(<Probe />);
  expect(pointer()).toBe('coarse');
});

test('usePointer is coarse when (hover: hover) fails', () => {
  stubMatchMedia({ '(pointer: fine)': true, '(hover: hover)': false });
  render(<Probe />);
  expect(pointer()).toBe('coarse');
});

test('usePointer flips when a media query fires change', () => {
  const media = stubMatchMedia({ '(pointer: fine)': true, '(hover: hover)': true });
  render(<Probe />);
  expect(pointer()).toBe('fine');
  media.set('(hover: hover)', false);
  expect(pointer()).toBe('coarse');
  media.set('(hover: hover)', true);
  expect(pointer()).toBe('fine');
});

test('usePointer is fine when window.matchMedia is missing', () => {
  expect('matchMedia' in window).toBe(false);
  render(<Probe />);
  expect(pointer()).toBe('fine');
});
