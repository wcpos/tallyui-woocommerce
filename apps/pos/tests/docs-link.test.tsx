import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { DocsLink } from '../components/docs-link';

afterEach(cleanup);

test('DocsLink renders with the link role', () => {
  render(<DocsLink testID="dl" href="https://docs.wcpos.com/x">Learn more</DocsLink>);
  expect(screen.getByTestId('dl').getAttribute('role')).toBe('link');
});

test('DocsLink is found as a named link and not a button', () => {
  render(<DocsLink testID="dl" href="https://docs.wcpos.com/x">Learn more</DocsLink>);
  expect(screen.getByRole('link', { name: /Learn more/ })).toBe(screen.getByTestId('dl'));
  expect(screen.queryByRole('button')).toBeNull();
});

test('DocsLink opens its href when clicked', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<DocsLink testID="dl" href="https://docs.wcpos.com/x">Learn more</DocsLink>);
  fireEvent.click(screen.getByRole('link', { name: /Learn more/ }));
  expect(open).toHaveBeenCalledExactlyOnceWith('https://docs.wcpos.com/x');
  open.mockRestore();
});
