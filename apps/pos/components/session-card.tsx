import type { JSX } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { formatClosureDate } from '@tallyui/pos';
import { useRegister } from '../lib/register/register-context';
import { PrintIcon } from './report-chips';

/** `HH:mm` on today's device date, otherwise `{weekday_short} HH:mm`. */
export function openedAtLabel(iso: string, locale: string): string {
  const f = formatClosureDate(iso, { timezone: 'device', locale });
  const today = formatClosureDate(new Date().toISOString(), { timezone: 'device', locale }).date_ymd;
  return f.date_ymd === today ? f.time : `${f.weekday_short} ${f.time}`;
}

export function SessionCard({ currency, locale, resolveCashierName, onPrintXReport }: {
  currency: string; locale: string;
  resolveCashierName(id: string): string;
  onPrintXReport(): void;
}): JSX.Element | null {
  const register = useRegister();
  const { session, salesCount } = register;
  if (!register.enabled || (session?.status !== 'open' && session?.status !== 'counting')) return null;
  const name = session.opened_by ? resolveCashierName(session.opened_by) : 'Cashier';
  const money = (amount: number) => formatMoney({ amount, currency }, locale) ?? '';

  return (
    <View testID="reports-session-card" className="flex-row items-center gap-3 border-b border-border py-3">
      <View className="min-w-0 flex-1 gap-1">
        <Text><Text className="text-success">●</Text>{` Open · ${register.registerName ?? 'This till'}`}</Text>
        <Text className="text-muted-foreground">
          {`since ${openedAtLabel(session.opened_at_gmt, locale)} · ${name} · ${salesCount === 1 ? '1 sale' : `${salesCount} sales`}`}
        </Text>
      </View>
      {!register.blind && <View className="items-end">
        <Text testID="session-expected" className="tabular-nums">{money(register.expected.cash ?? 0)}</Text>
        <Text className="text-muted-foreground text-sm">Expected</Text>
      </View>}
      {/* v2 closures/session-card.tsx: `leftIcon="print"` before Print X-report. */}
      {!register.blind && <Button testID="x-report-print" variant="outline" onPress={onPrintXReport}><PrintIcon testID="x-report-print-icon" size={16} /><Text>Print X-report</Text></Button>}
    </View>
  );
}
