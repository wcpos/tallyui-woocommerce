// v2's route error gate (components/src/error-boundary/fallback-screen.tsx): a throw while rendering shows
// "Something went wrong", the message cut to 300 characters, and Try again re-renders the route.
import { Component, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DETAIL_MAX, RouteErrorScreen } from '../components/route-error-screen';

// expo-router's `Try` (build/views/Try.js) is not on its public entry: this stand-in passes the same
// `{ error, retry }`, where retry clears the error so the children render again.
class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  retry = () => new Promise<void>((resolve) => { this.setState({ error: undefined }, resolve); });
  render() {
    return this.state.error ? <RouteErrorScreen error={this.state.error} retry={this.retry} /> : this.props.children;
  }
}

const thrown = { error: new Error('boom'), active: true };
function Thrower() {
  if (thrown.active) throw thrown.error;
  return <span data-testid="route-content">Register</span>;
}

beforeEach(() => {
  // React reports every caught render error on console.error.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  thrown.error = new Error('boom');
  thrown.active = true;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('a child that throws shows the gate with the title and the message', () => {
  render(<Boundary><Thrower /></Boundary>);
  expect(screen.getByTestId('error-boundary-screen')).not.toBeNull();
  expect(screen.getByTestId('error-boundary-screen-title').textContent).toBe('Something went wrong');
  expect(screen.getByTestId('error-boundary-screen-detail').textContent).toBe('boom');
  expect(screen.getByTestId('error-boundary-retry').textContent).toBe('Try again');
  expect(screen.queryByTestId('route-content')).toBeNull();
});

test('a 400-character message is cut to 300 characters ending in an ellipsis', () => {
  const long = Array.from({ length: 400 }, (_, i) => String(i % 10)).join('');
  thrown.error = new Error(long);
  render(<Boundary><Thrower /></Boundary>);
  const detail = screen.getByTestId('error-boundary-screen-detail').textContent ?? '';
  expect(DETAIL_MAX).toBe(300);
  expect(detail).toHaveLength(300);
  expect(detail.endsWith('…')).toBe(true);
  expect(detail.slice(0, 299)).toBe(long.slice(0, 299));
});

test('Try again calls retry and the child renders once it stops throwing', async () => {
  const retry = vi.fn(async () => {});
  render(<RouteErrorScreen error={new Error('boom')} retry={retry} />);
  fireEvent.click(screen.getByTestId('error-boundary-retry'));
  expect(retry).toHaveBeenCalledTimes(1);
  cleanup();

  render(<Boundary><Thrower /></Boundary>);
  expect(screen.queryByTestId('route-content')).toBeNull();
  thrown.active = false;
  fireEvent.click(screen.getByTestId('error-boundary-retry'));
  expect((await screen.findByTestId('route-content')).textContent).toBe('Register');
  expect(screen.queryByTestId('error-boundary-screen')).toBeNull();
});

test('no stack text is shown', () => {
  const error = new Error('boom');
  error.stack = 'Error: boom\n    at STACK_MARKER (route.tsx:1:1)';
  thrown.error = error;
  const { container } = render(<Boundary><Thrower /></Boundary>);
  const text = container.textContent ?? '';
  expect(text).toContain('boom');
  expect(text).not.toContain('STACK_MARKER');
  expect(text).not.toContain('Error:');
});
