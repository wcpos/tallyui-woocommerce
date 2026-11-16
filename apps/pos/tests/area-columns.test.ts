import { expect, test } from 'vitest';
import { visibleAreaColumns } from '../lib/area-columns';

test('keeps visible columns in the columns\' order when settings have a different order', () => {
  const columns = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const settings = [
    { id: 'c', visible: true },
    { id: 'a', visible: true },
    { id: 'b', visible: false },
  ];
  expect(visibleAreaColumns(columns, settings)).toEqual([{ id: 'a' }, { id: 'c' }]);
});

test('hides a column with no setting', () => {
  const columns = [{ id: 'a' }, { id: 'b' }];
  expect(visibleAreaColumns(columns, [{ id: 'a', visible: true }])).toEqual([{ id: 'a' }]);
});

test('returns no columns for empty settings', () => {
  expect(visibleAreaColumns([{ id: 'a' }], [])).toEqual([]);
});
