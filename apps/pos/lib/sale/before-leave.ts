// Work that must finish before the app leaves the page for a sign-in redirect: the sale screen
// parks its open cart here. A handler resolves null when the page may go, or the reason it may not.
// One tab, one database (single instance), so a module-level handler is enough.
export type BeforeLeave = () => Promise<string | null>;
let handler: BeforeLeave | null = null;
export function setBeforeLeave(next: BeforeLeave | null): void { handler = next; }
// Clears the handler only while it is still this one, so a screen unmounting late never removes a newer screen's handler.
export function clearBeforeLeave(mine: BeforeLeave): void { if (handler === mine) handler = null; }
export async function runBeforeLeave(): Promise<string | null> { return handler ? handler() : null; }
