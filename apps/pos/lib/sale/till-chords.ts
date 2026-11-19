// WCPOS v2's chord map (hotkeys/bindings.ts:7-35) with its command labels (en core.json pos_commands.*), in v2's order.
export const TILL_CHORDS = [
  { id: 'pos.search.focus', label: 'Search products', code: 'KeyF', key: 'F' },
  { id: 'pos.checkout.open', label: 'Checkout', code: 'KeyP', key: 'P' },
  { id: 'pos.cart.new', label: 'New cart', code: 'KeyN', key: 'N' },
  { id: 'pos.cart.previous', label: 'Previous cart', code: 'ArrowLeft', key: '←' },
  { id: 'pos.cart.next', label: 'Next cart', code: 'ArrowRight', key: '→' },
  { id: 'pos.cart.discount', label: 'Add discount', code: 'KeyD', key: 'D' },
  { id: 'pos.cart.void', label: 'Void order', code: 'KeyV', key: 'V' },
  { id: 'pos.help.open', label: 'Keyboard shortcuts', code: 'Slash', key: '/' },
] as const;
export type TillChordId = (typeof TILL_CHORDS)[number]['id'];

/** v2's chordPlatform: a Mac labels Alt as Option; so does an iPad's keyboard, which reports itself as a Mac. */
export function chordPlatform(): 'mac' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'other';
}

/** v2's describeChord: `⌥` `F` on a Mac, `Alt` `F` elsewhere. */
export const keycaps = (key: string, platform = chordPlatform()): string[] => [platform === 'mac' ? '⌥' : 'Alt', key];

/** Presses Alt+code on the document, so a row runs its command through the binding its key reaches, gate and all. */
export function pressChord(code: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { code, altKey: true, bubbles: true, cancelable: true }));
}
