import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Switch, Text } from '@tallyui/components';
import { queueReceiptEmail } from '../lib/receipts/receipt-emails';
import type { ReceiptEmail as EmailRequest, ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { toast } from '../lib/toast/toast';

// WCPOS v2's receipt/email.tsx dialog behind receipt-actions.tsx's Email Receipt button.
export function ReceiptEmail({ collection, orderId, defaultEmail, localOnly = false }: {
  collection: ReceiptEmailCollection; orderId: string; defaultEmail: string;
  /** v2's localOnly: the store has not confirmed this sale yet, so the dialog reads as offline. */
  localOnly?: boolean;
}) {
  const [request, setRequest] = useState<EmailRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [saveToBilling, setSaveToBilling] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    let last: string | null | undefined;
    const subscription = collection.findOne(orderId).$.subscribe(doc => {
      const next = doc ? doc.toJSON() as EmailRequest : null;
      // v2 email.tsx:144 toasts Email sent for a send it saw; a request already sent on mount stays quiet.
      if (last !== undefined && last !== 'sent' && next?.status === 'sent') toast({ type: 'success', title: 'Email sent' });
      last = next?.status ?? null;
      setRequest(next);
    });
    return () => subscription.unsubscribe();
  }, [collection, orderId]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const offline = localOnly || !online;
  // The order's billing email: the call site passes the sale customer's address, which connector-woocommerce
  // writes to the order's billing.email on create (v2 email.tsx defaults the field to orderData.billing?.email).
  const billingEmail = defaultEmail.trim();
  const replacesBilling = saveToBilling && billingEmail !== '' && billingEmail !== email.trim();

  function show() {
    setEmail(request?.email ?? defaultEmail);
    setSaveToBilling(false);
    setError(undefined);
    setOpen(true);
  }

  async function send() {
    setError(undefined);
    setBusy(true);
    try {
      // The switch rides on the queue row; the sender passes it to the store (v2 email.tsx saveToBilling).
      await queueReceiptEmail(collection, orderId, email, undefined, { saveToBilling });
      // v2 email.tsx:98: receipt.email_queued and its detail.
      toast({ type: 'success', title: 'Receipt email queued', description: 'It will send as soon as this device can reach your store.' });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (request?.status === 'sending') return <Text>Sending the receipt…</Text>;
  return (
    <View testID="receipt-email" className="gap-2 py-4">
      {request?.error ? <Text accessibilityRole="alert">{request.error}</Text> : null}
      <Button testID="receipt-email-button" variant="outline" onPress={show}><Text>Email Receipt</Text></Button>
      {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader><DialogTitle>Email Receipt</DialogTitle></DialogHeader>
          <View className="gap-2">
            <Text>Email Address</Text>
            <Input><Input.Field testID="receipt-email-address" value={email} onChangeText={setEmail}
              accessibilityLabel="Email Address" keyboardType="email-address" autoCapitalize="none" /></Input>
          </View>
          <View className="flex-row items-center gap-2">
            <Switch size="sm" testID="receipt-email-save-to-billing" accessibilityLabel="Save email to Billing Address"
              checked={saveToBilling} onCheckedChange={setSaveToBilling} />
            <Text>Save email to Billing Address</Text>
          </View>
          {replacesBilling ? <Text testID="receipt-email-billing-replaces" className="text-muted-foreground">
            {`Replaces ${billingEmail} on this order’s billing address.`}
          </Text> : null}
          {offline ? <Text testID="receipt-email-offline-notice" className="text-muted-foreground">
            This device can’t reach your store right now. The receipt will be emailed automatically when the connection returns.
          </Text> : null}
          {error ? <Text testID="receipt-email-error" accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
          <DialogFooter>
            <Button testID="dialog-footer-close" variant="outline" onPress={() => setOpen(false)}><Text>Cancel</Text></Button>
            <Button testID="receipt-email-send" disabled={busy} onPress={() => { void send(); }}>
              <Text>{offline ? 'Send when online' : 'Send'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </View>
  );
}
