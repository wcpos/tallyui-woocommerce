import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { PortalHost } from '@tallyui/primitives';
import { SUPPORT_LINKS, SupportScreen } from '../components/support-screen';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ISSUES_URL = 'https://github.com/wcpos/tallyui-woocommerce/issues';
const README_URL = 'https://github.com/wcpos/tallyui-woocommerce#readme';

test('renders the Support page: its bar titled Support and one link per SUPPORT_LINKS entry in order', () => {
  render(<><SupportScreen onBack={vi.fn()} /><PortalHost /></>);
  expect(screen.getByTestId('screen-support')).not.toBeNull();
  expect(within(screen.getByTestId('support-bar')).getByText('Support')).not.toBeNull();
  const links = within(screen.getByTestId('support-frame')).getAllByTestId(/^support-link-[a-z]+$/);
  expect(links).toHaveLength(SUPPORT_LINKS.length);
  expect(links.map(link => link.getAttribute('data-testid'))).toEqual(SUPPORT_LINKS.map(link => `support-link-${link.id}`));
  // The desk's two links (2026-11-18), in this order.
  expect(SUPPORT_LINKS.map(link => [link.id, link.href])).toEqual([['issues', ISSUES_URL], ['docs', README_URL]]);
  expect(links.map(link => link.textContent)).toEqual(['Report a problem', 'Read the docs']);
  expect(screen.getByTestId('support-description-issues').textContent).toBe('Open an issue on GitHub. Say what you did and what you saw.');
  expect(screen.getByTestId('support-description-docs').textContent).toBe('Setup, supported stores and features.');
});

test('each link opens its own URL', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<SupportScreen onBack={vi.fn()} />);
  fireEvent.click(screen.getByTestId('support-link-issues'));
  expect(open).toHaveBeenLastCalledWith(ISSUES_URL);
  fireEvent.click(screen.getByTestId('support-link-docs'));
  expect(open).toHaveBeenLastCalledWith(README_URL);
  expect(open).toHaveBeenCalledTimes(2);
});

test('Back calls onBack', () => {
  const onBack = vi.fn();
  render(<SupportScreen onBack={onBack} />);
  fireEvent.click(screen.getByTestId('support-back'));
  expect(onBack).toHaveBeenCalledOnce();
});
