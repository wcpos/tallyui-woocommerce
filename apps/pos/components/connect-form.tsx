import { useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Button, IconButton, Input, Label, Text, XIcon } from '@tallyui/components';
import { CONNECT_STAGE_COPY, errorCodeDocUrl, useConnectDiscovery } from '../lib/auth/use-connect-discovery';
import type { StartSignIn } from '../lib/auth/use-connect-discovery';

export interface ConnectFormProps {
  startSignIn: StartSignIn;
  signInError?: string; // the `error` query param from the sign-in callback
  saved?: ReactNode;
}

export function ConnectForm({ startSignIn, signInError, saved }: ConnectFormProps): JSX.Element {
  const [siteInput, setSiteInput] = useState('');
  const [formOpen, setFormOpen] = useState(signInError !== undefined);
  const [showSignInError, setShowSignInError] = useState(true);
  const discovery = useConnectDiscovery(startSignIn);
  const { stage, busy, errorCode } = discovery;
  // v2 add-user-button.tsx:64-71 (auth.login_did_not_complete and its _hint), shown inline here.
  const callbackMessage = signInError === undefined ? null : "The login didn't complete.";
  const message = discovery.error ?? (showSignInError ? callbackMessage : null);
  const hint = message !== null && !discovery.error;
  function onChangeText(value: string) {
    setSiteInput(value);
    setShowSignInError(false);
    discovery.reset();
  }
  function connect() {
    if (siteInput.trim() === '') return;
    setShowSignInError(false);
    void discovery.connect(siteInput);
  }
  return (
    <ScrollView style={{ flex: 1 }} className="bg-background"
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}
      keyboardShouldPersistTaps="handled">
      <View className="w-full max-w-[460px] gap-5 py-4">
      {saved}
      {saved && !formOpen ? <Button variant="ghost" testID="connect-another-store" onPress={() => setFormOpen(true)}>
        <Text>Connect another store</Text>
      </Button> : null}
      {!saved || formOpen ? <View className="w-full gap-4">
          <Label nativeID="store-url-label">Your store's address</Label>
          <Input disabled={busy}>
            <Input.Field testID="store-url-input" accessibilityLabelledBy="store-url-label"
              value={siteInput} onChangeText={onChangeText} onSubmitEditing={connect}
              autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="mystore.com" autoFocus />
            {siteInput !== '' && !busy ? <Input.Right><IconButton testID="store-url-clear" accessibilityLabel="Clear"
              onPress={() => onChangeText('')}><XIcon size={16} className="text-muted-foreground" /></IconButton></Input.Right> : null}
          </Input>
          <Button testID="connect-store-button" disabled={busy || siteInput.trim() === ''}
            accessibilityState={{ busy }} onPress={connect}><Text>Connect</Text></Button>
          {stage ? <Text testID="connect-progress" accessibilityLiveRegion="polite"
            className="text-sm text-muted-foreground">{CONNECT_STAGE_COPY[stage]}</Text> : null}
          {message ? <Text testID="connect-error-message" className="text-destructive">{message}</Text> : null}
          {hint ? <Text testID="connect-error-hint" className="text-sm text-muted-foreground">
            Nothing is lost — unsent changes send once you're signed in. Try logging in again.</Text> : null}
          {errorCode ? <Button testID={`connect-error-docs-link-${errorCode}`} variant="link" size="sm"
            role="link" className="self-start px-0" onPress={() => { void Linking.openURL(errorCodeDocUrl(errorCode)); }}>
            <Text>Learn more</Text><Text className="text-muted-foreground">{`· ${errorCode}`}</Text>
          </Button> : null}
      </View> : null}
      </View>
    </ScrollView>
  );
}
