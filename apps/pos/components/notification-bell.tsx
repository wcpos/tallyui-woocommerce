// v2's register-bar bell (WCPOS monorepo `packages/core/src/screens/main/components/notification-bell/notification-bell.tsx`:
// `register-bar-bell`, labelled Notifications, opening a right side sheet) and its panel
// (`notification-panel.tsx`: the `notifications-empty` state). v2's feed comes from Novu; this app has no
// notifications feed yet, so the sheet always shows the empty state.
import { useState } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import { Path } from 'react-native-svg';
import { Button, createSvgIcon, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, IconButton, Text } from '@tallyui/components';

const BellIcon = createSvgIcon('BellIcon', () => <><Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);

// v2's right side sheet, as the cashier sheet.
const SIDE_SHEET = 'left-auto right-0 top-0 h-full max-w-lg translate-x-0 translate-y-0 rounded-none border-0 border-l';

/** `testID` is the bar's own, as v2's `<bar>-bell` (bar-controls/index.tsx); the register bar keeps `register-bar-bell`. */
export function NotificationBell({ testID = 'register-bar-bell' }: { testID?: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  return <>
    {/* v2's bell is a default IconButton (notification-bell.tsx:40): its 18 px glyph (`size-4.5`, icon/index.tsx:27) in
        text-muted-foreground (icon-button/index.tsx:93). */}
    <IconButton testID={testID} accessibilityLabel="Notifications" onPress={() => setOpen(true)}>
      <BellIcon testID={`${testID}-icon`} size={18} className="text-muted-foreground" />
    </IconButton>
    {open && <Dialog open onOpenChange={setOpen}>
      <DialogContent testID="notifications-sheet" className={SIDE_SHEET}>
        <DialogHeader><DialogTitle>Notifications</DialogTitle></DialogHeader>
        <View testID="notifications-empty" className="flex-1 items-center justify-center p-6"><Text className="text-muted-foreground">No notifications</Text></View>
        <DialogFooter><Button variant="outline" testID="notifications-close" onPress={() => setOpen(false)}><Text>Close</Text></Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </>;
}
