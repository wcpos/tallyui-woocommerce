import { act, fireEvent, screen, within } from '@testing-library/react';

type LayoutNode = Element & {
  __reactLayoutHandler: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
};

// RNW attaches onLayout to the node; jsdom has no ResizeObserver, so the test reports the sizes.
function layout(node: Element | null, width: number) {
  (node as LayoutNode).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width, height: 52 } } });
}

/** Report the open-order strip's width and its tabs' content width; the ScrollView's content container reports onContentSizeChange. */
export function stripLayout(stripWidth: number, contentWidth: number) {
  act(() => {
    layout(screen.getByTestId('open-order-strip'), stripWidth);
    layout(screen.getByTestId('open-order-scroll').firstElementChild, contentWidth);
  });
}

/** Overflow the strip so its count cell shows, then press it: it toggles the open-orders list over the cart. */
export function openParkedList() {
  stripLayout(300, 900);
  fireEvent.click(screen.getByTestId('open-orders-count'));
}

/** The list's row for the strip's parked cart at `index` (the list and the strip share one order). */
export function parkedRow(index = 0): HTMLElement {
  const id = parkedTabs()[index].getAttribute('data-testid')!.slice('open-order-tab-'.length);
  return within(screen.getByTestId('open-orders-list')).getByTestId(`open-orders-row-${id}`);
}

/** A list row's items line and its text, for a parked cart's content and total. */
export function rowContents(row: HTMLElement): { items: string; text: string } {
  return { items: within(row).getByTestId(`${row.getAttribute('data-testid')}-items`).textContent!, text: row.textContent! };
}

/** Open the list and resume the strip's parked cart at `index` from its row. */
export async function resumeFromList(index = 0) {
  openParkedList();
  const row = parkedRow(index);
  await act(async () => { fireEvent.click(row); });
}

/** The strip's parked cart tabs: every tab but the current sale's and +. */
export function parkedTabs() {
  return within(screen.getByTestId('open-order-strip')).queryAllByRole('tab')
    .filter(tab => tab.getAttribute('aria-selected') === 'false' && tab.getAttribute('data-testid') !== 'new-order-tab');
}
