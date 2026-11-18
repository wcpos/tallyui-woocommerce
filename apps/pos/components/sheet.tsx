// The side sheets' shared chrome (v2 dialog/index.tsx): the sheet's frame, title rank, Close and Restore buttons.
import type { JSX } from 'react';
import { Button, Text } from '@tallyui/components';

export const RIGHT_SHEET = 'left-auto right-0 top-0 h-full w-full max-w-lg translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-l border-border bg-card p-0 py-4';
export const LEFT_SHEET = 'left-0 right-auto top-0 h-full w-full max-w-lg translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-r border-border bg-card p-0 py-4';

/** v2's DialogFooter `destructive` slot (dialog/index.tsx): Button `outline-destructive`, a red border on the card fill
 *  with the foreground label. TallyUI has no such variant, so it is `outline` with v2's border and fill; the label
 *  takes the outline's `text-foreground`. The catalogue, area and cart settings sheets all draw this one.
 *  `h-11` is v2's Button `size.default` `h-ctl` (button/index.tsx; `--spacing-ctl: 44px`), over TallyUI's h-10. */
export function RestoreDefaultsButton({ testID, onPress }: { testID: string; onPress(): void }): JSX.Element {
  return <Button testID={testID} variant="outline" className="h-11 border-destructive" onPress={onPress}>
    <Text testID={`${testID}-label`}>Restore Default Settings</Text>
  </Button>;
}

/** v2's DialogFooter dismiss (dialog/index.tsx: a Button `variant="outline"`), whose outline is `border-border bg-card`
 *  with an accent hover (button/index.tsx). TallyUI's outline is `border-input bg-card`, so only v2's border-border
 *  needs overriding. The catalogue, area and cart settings sheets all draw this one.
 *  `h-11` is v2's `h-ctl`, 44 px, as on Restore. */
export function SheetCloseButton({ testID, onPress, className }: { testID: string; onPress(): void; className?: string }): JSX.Element {
  return <Button testID={testID} variant="outline" className={`h-11 border-border web:hover:bg-accent ${className ?? ''}`} onPress={onPress}><Text>Close</Text></Button>;
}

/** v2's DialogTitle (dialog/index.tsx) is the dialog rank (text/ladder.ts `dialog: 'text-lg font-strong'`), 16 px on
 *  v2's 14 px ramp, `leading-none`, so the header row is 16 px tall. global.css takes that ramp, so `text-lg` is 16 px
 *  here too. TallyUI 3.19.0's DialogTitle keeps leading-none beside a caller's text size, so the app need not add it. */
export const SHEET_TITLE = 'text-lg';
