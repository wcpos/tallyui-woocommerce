// The held-session band (v2 components/session-hold-banner): shown while the session's refresh was refused or the outbox needs a sign-in; sales keep queueing meanwhile.
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '../lib/auth/session-context';
import { useOutbox } from '../lib/sale/outbox-context';

export function sessionHoldCopy(hold: { held: boolean; authRequired: boolean; salesWaiting: number }):
  { title: string; description: string } | null {
  if (!hold.held && !hold.authRequired) return null;
  if (hold.salesWaiting > 0) {
    const n = hold.salesWaiting;
    return { title: n === 1 ? `${n} sale waiting to sync` : `${n} sales waiting to sync`, description: 'Log in to continue.' };
  }
  return { title: 'Session expired', description: 'Sign in to reconnect to the store.' };
}

export function SessionHoldBanner(): JSX.Element | null {
  const { held, startReauth } = useSession();
  const outbox = useOutbox();
  const [refusal, setRefusal] = useState<string | null>(null);
  const busy = useRef(false);
  async function logIn() {
    if (busy.current) return;
    busy.current = true;
    try { setRefusal(await startReauth()); }
    catch (error) { setRefusal(error instanceof Error ? error.message : String(error)); }
    finally { busy.current = false; }
  }
  const copy = sessionHoldCopy({ held, authRequired: outbox.enabled && outbox.state.authRequired === true,
    salesWaiting: outbox.enabled ? outbox.state.pending : 0 });
  useEffect(() => { if (!copy) setRefusal(null); }, [copy]);
  if (!copy) return null;
  return (
    <View className="bg-background px-3 pt-3" dataSet={{ print: 'hide' }}>
      <View testID="session-hold-banner" role="alert" aria-live="assertive"
        className="flex-row flex-wrap items-center gap-2 rounded-lg border border-destructive/45 bg-destructive/10 px-3 py-2.5">
        <View className="min-w-0 flex-1 basis-48">
          <Text testID="session-hold-banner-title" className="font-medium text-foreground">{copy.title}</Text>
          <Text testID="session-hold-banner-description" className="text-muted-foreground">{copy.description}</Text>
        </View>
        <Button variant="ghost" size="sm" testID="session-hold-login" onPress={logIn}><Text>Log in</Text></Button>
        {refusal ? <Text testID="session-hold-refusal" className="w-full text-destructive">{refusal}</Text> : null}
      </View>
    </View>
  );
}
