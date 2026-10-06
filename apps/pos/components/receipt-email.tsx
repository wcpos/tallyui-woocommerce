import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Text } from '@tallyui/components';
import { queueReceiptEmail } from '../lib/receipts/receipt-emails';
import type { ReceiptEmail as EmailRequest, ReceiptEmailCollection } from '../lib/receipts/receipt-emails';

export function ReceiptEmail({ collection, orderId, defaultEmail }: {
  collection: ReceiptEmailCollection; orderId: string; defaultEmail: string;
}) {
  const [request, setRequest] = useState<EmailRequest | null>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const subscription = collection.findOne(orderId).$.subscribe(doc => setRequest(doc ? doc.toJSON() as EmailRequest : null));
    return () => subscription.unsubscribe();
  }, [collection, orderId]);

  async function queue() {
    setError(undefined);
    try { await queueReceiptEmail(collection, orderId, email); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }

  if (request?.status === 'queued') return <Text>Receipt email queued. It sends when this sale has synced and the till is online.</Text>;
  if (request?.status === 'sending') return <Text>Sending the receipt…</Text>;
  if (request?.status === 'sent') return <Text>{`Receipt emailed to ${request.email}`}</Text>;
  return (
    <View className="gap-2 py-4">
      {request?.error ? <Text>{request.error}</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Input><Input.Field value={email} onChangeText={setEmail} placeholder="Email address"
        accessibilityLabel="Email address" keyboardType="email-address" autoCapitalize="none" /></Input>
      <Button onPress={queue}><Text>{request?.status === 'failed' ? 'Send again' : 'Email receipt'}</Text></Button>
    </View>
  );
}
