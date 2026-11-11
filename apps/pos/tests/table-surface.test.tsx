import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { Text } from '@tallyui/components';
import { CaptionRowInset, TableSurface } from '../components/table-surface';
import { classesOf } from './classes-of';

function setWidth(width: number) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSurface() {
  render(<><TableSurface testID="surface" /><CaptionRowInset><Text>Showing 1</Text></CaptionRowInset></>);
}

test("in a window the table sits on v2's card: rounded, bordered, inset like the search above it", () => {
  setWidth(1280);
  renderSurface();
  expect(classesOf('surface')).toEqual(expect.arrayContaining(['rounded-lg', 'border', 'bg-card', 'mx-4', 'min-h-0', 'flex-1']));
  expect(classesOf('surface')).not.toContain('border-t');
  expect(classesOf('data-table-caption-inset')).toEqual(expect.arrayContaining(['px-4', 'pb-4']));
});

test('on a phone the table runs edge to edge under a hairline: no side inset, no radius', () => {
  setWidth(390);
  renderSurface();
  const classes = classesOf('surface');
  expect(classes).toEqual(expect.arrayContaining(['border-t', 'bg-card', 'min-h-0', 'flex-1']));
  expect(classes).not.toContain('rounded-lg');
  expect(classes).not.toContain('border');
  expect(classes).not.toContain('mx-4');
  expect(classesOf('data-table-caption-inset')).toEqual(expect.arrayContaining(['px-1', 'pb-4']));
});
