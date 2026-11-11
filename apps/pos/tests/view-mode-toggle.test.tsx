import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ViewModeToggle } from '../components/view-mode-toggle';

afterEach(cleanup);

test('in grid view it offers the table and a press asks for it', () => {
  const onChange = vi.fn();
  render(<ViewModeToggle view="grid" onChange={onChange} />);
  const toggle = screen.getByTestId('view-mode-toggle');
  expect(toggle.getAttribute('aria-label')).toBe('Switch to table view');
  expect(screen.getByRole('button', { name: 'Switch to table view' })).toBe(toggle);
  fireEvent.click(toggle);
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange).toHaveBeenCalledWith('table');
});

test('in table view it offers the grid and a press asks for it', () => {
  const onChange = vi.fn();
  render(<ViewModeToggle view="table" onChange={onChange} />);
  const toggle = screen.getByTestId('view-mode-toggle');
  expect(toggle.getAttribute('aria-label')).toBe('Switch to grid view');
  fireEvent.click(toggle);
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange).toHaveBeenCalledWith('grid');
});
