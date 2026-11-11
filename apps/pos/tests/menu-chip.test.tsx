import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { MenuChip } from '../components/menu-chip';
import { classesOf } from './classes-of';

afterEach(cleanup);

const choices = [{ value: 'all', label: 'Everyone' }, { value: '2', label: 'Paul' }, { value: '5', label: 'Ann' }];

function setup(value = 'all', hint: string | null = 'A hint') {
  const onChange = vi.fn();
  render(<><MenuChip name="cashier" value={value} defaultValue="all" choices={choices} onChange={onChange} hint={hint ?? undefined} /><PortalHost /></>);
  return onChange;
}

test('the chip shows the chosen label, or the raw value when no choice matches', () => {
  setup('5');
  expect(screen.getByTestId('hero-chip-cashier').textContent).toBe('Ann');
  cleanup();
  setup('9');
  expect(screen.getByTestId('hero-chip-cashier').textContent).toBe('9');
});

test('pressing the chip opens a menu of every choice with the chosen one marked, then the hint', async () => {
  setup('2');
  expect(screen.queryByTestId('hero-cashier-menu')).toBeNull();
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  const menu = within(await screen.findByTestId('hero-cashier-menu'));
  expect(menu.getAllByRole('menuitem').map(row => row.textContent)).toEqual(['Everyone', 'Paul✓', 'Ann']);
  expect(screen.getByTestId('hero-cashier-2').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('hero-cashier-all').getAttribute('aria-selected')).toBe('false');
  expect(menu.getByTestId('hero-cashier-menu-hint').textContent).toBe('A hint');
});

test('choosing a different row reports it once and closes the menu', async () => {
  const onChange = setup();
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  fireEvent.click(await screen.findByTestId('hero-cashier-5'));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('5');
  expect(screen.queryByTestId('hero-cashier-menu')).toBeNull();
});

test('choosing the current row closes the menu without reporting', async () => {
  const onChange = setup('2');
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  fireEvent.click(await screen.findByTestId('hero-cashier-2'));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByTestId('hero-cashier-menu')).toBeNull();
});

test('the clear shows only off the default and puts the default back without opening the menu', () => {
  setup('all');
  expect(screen.queryByTestId('hero-chip-cashier-clear')).toBeNull();
  cleanup();
  const onChange = setup('5');
  const clear = screen.getByTestId('hero-chip-cashier-clear');
  expect(clear.getAttribute('aria-label')).toBe('Clear');
  fireEvent.click(clear);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('all');
  expect(screen.queryByTestId('hero-cashier-menu')).toBeNull();
});

test('a press outside the menu, on its overlay, closes it without reporting', async () => {
  const onChange = setup('2');
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  await screen.findByTestId('hero-cashier-menu');
  fireEvent.click(screen.getByTestId('hero-cashier-overlay'));
  expect(screen.queryByTestId('hero-cashier-menu')).toBeNull();
  expect(screen.queryByTestId('hero-cashier-overlay')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test('Escape closes the open menu without reporting', async () => {
  const onChange = setup('2');
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  await screen.findByTestId('hero-cashier-menu');
  fireEvent.keyDown(document, { key: 'Enter' });
  expect(screen.getByTestId('hero-cashier-menu')).not.toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByTestId('hero-cashier-menu')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test('a chip without a hint shows no hint', async () => {
  setup('all', null);
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  await screen.findByTestId('hero-cashier-menu');
  expect(screen.queryByTestId('hero-cashier-menu-hint')).toBeNull();
});

test('the chip is v2 Chip: a 44 rounded pill with a leading icon, tinted when off its default', () => {
  const Glyph = (props: { testID?: string; className?: string }) => <span data-testid={props.testID} className={props.className} />;
  render(<MenuChip name="cashier" icon={Glyph} value="all" defaultValue="all" choices={choices} onChange={vi.fn()} />);
  expect(classesOf('hero-chip-cashier-face')).toEqual(expect.arrayContaining(['h-11', 'rounded-full', 'border-border', 'bg-card']));
  expect(classesOf('hero-chip-cashier-face')).not.toContain('rounded-md');
  expect(screen.getByTestId('hero-chip-cashier').firstElementChild).toBe(screen.getByTestId('hero-chip-cashier-icon'));
  expect(screen.getByTestId('hero-chip-cashier-icon').getAttribute('class')).toBe('text-foreground');
  cleanup();
  render(<MenuChip name="cashier" icon={Glyph} value="5" defaultValue="all" choices={choices} onChange={vi.fn()} />);
  expect(classesOf('hero-chip-cashier-face')).toEqual(expect.arrayContaining(['rounded-full', 'border-primary', 'bg-primary/10']));
  expect(screen.getByTestId('hero-chip-cashier-icon').getAttribute('class')).toBe('text-primary');
  cleanup();
  setup();
  expect(screen.queryByTestId('hero-chip-cashier-icon')).toBeNull();
});

test('the chip draws no caret after its label, as v2\'s Chip, on or off its default', () => {
  setup('all');
  expect(screen.getByTestId('hero-chip-cashier').textContent).not.toContain('▾');
  cleanup();
  setup('5');
  expect(screen.getByTestId('hero-chip-cashier').textContent).not.toContain('▾');
});
