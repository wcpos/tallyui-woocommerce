import { useState } from 'react';
import type { JSX } from 'react';
import { Linking, View } from 'react-native';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Text } from '@tallyui/components';
import { CONNECT_STAGE_COPY, errorCodeDocUrl, useConnectDiscovery } from '../lib/auth/use-connect-discovery';
import type { StartSignIn } from '../lib/auth/use-connect-discovery';

export interface ConnectFormProps {
  startSignIn: StartSignIn;
  signInError?: string; // the `error` query param from the sign-in callback
}

export function ConnectForm({ startSignIn, signInError }: ConnectFormProps): JSX.Element {
  const [siteInput, setSiteInput] = useState('');
  const [showSignInError, setShowSignInError] = useState(true);
  const discovery = useConnectDiscovery(startSignIn);
  const { stage, busy, errorCode } = discovery;
  const callbackMessage = signInError === undefined ? null
    : signInError === 'state_mismatch' ? 'Sign-in could not be verified. Try again.'
    : signInError === 'missing_token' ? 'The store did not return a sign-in token. Try again.'
    : signInError === 'no_pending' ? 'That sign-in link has expired. Try again.'
    : 'Sign-in failed. Try again.';
  const message = discovery.error ?? (showSignInError ? callbackMessage : null);
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
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Connect to your store</CardTitle></CardHeader>
        <CardContent className="gap-4">
          <Label nativeID="store-url-label">Your store's address</Label>
          <Input disabled={busy}>
            <Input.Field testID="store-url-input" accessibilityLabelledBy="store-url-label"
              value={siteInput} onChangeText={onChangeText} onSubmitEditing={connect}
              autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="mystore.com" />
          </Input>
          <Button testID="connect-store-button" disabled={busy || siteInput.trim() === ''}
            accessibilityState={{ busy }} onPress={connect}><Text>Connect</Text></Button>
          {stage ? <Text testID="connect-progress" accessibilityLiveRegion="polite"
            className="text-sm text-muted-foreground">{CONNECT_STAGE_COPY[stage]}</Text> : null}
          {message ? <Text testID="connect-error-message" className="text-destructive">{message}</Text> : null}
          {errorCode ? <Button testID={`connect-error-docs-link-${errorCode}`} variant="link" size="sm"
            role="link" className="self-start px-0" onPress={() => { void Linking.openURL(errorCodeDocUrl(errorCode)); }}>
            <Text>Learn more</Text><Text className="text-muted-foreground">{`· ${errorCode}`}</Text>
          </Button> : null}
        </CardContent>
      </Card>
    </View>
  );
}
