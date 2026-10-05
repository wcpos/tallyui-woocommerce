import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Text } from '@tallyui/components';
import { useSession } from '../lib/auth/session-context';
import { SiteError } from '../lib/auth/site';

export default function Connect() {
  const { startSignIn } = useSession();
  const { error: signInError } = useLocalSearchParams<{ error?: string }>();
  const [siteInput, setSiteInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = error ?? (signInError === undefined ? ''
    : signInError === 'state_mismatch' ? 'Sign-in could not be verified. Try again.'
    : signInError === 'missing_token' ? 'The store did not return a sign-in token. Try again.'
    : signInError === 'no_pending' ? 'That sign-in link has expired. Try again.'
    : 'Sign-in failed. Try again.');
  async function connect() {
    setBusy(true);
    setError('');
    try {
      await startSignIn(siteInput);
    } catch (error) {
      setError(error instanceof SiteError ? error.message : 'Could not connect. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Connect to your store</CardTitle></CardHeader>
        <CardContent className="gap-4">
          <Label nativeID="store-url-label">Store URL</Label>
          <Input disabled={busy}>
            <Input.Field accessibilityLabelledBy="store-url-label" value={siteInput} onChangeText={setSiteInput}
              autoCapitalize="none" keyboardType="url" placeholder="https://your-store.com" />
          </Input>
          {errorMessage ? <Text className="text-destructive">{errorMessage}</Text> : null}
          <Button disabled={busy} accessibilityState={{ busy }} onPress={connect}><Text>Continue</Text></Button>
        </CardContent>
      </Card>
    </View>
  );
}
