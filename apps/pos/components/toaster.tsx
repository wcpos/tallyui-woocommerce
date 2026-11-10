import { useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import { Toast, ToastTitle, ToastDescription, ToastClose } from '@tallyui/components';
import { dismissToast, getToasts, subscribeToasts } from '../lib/toast/toast';
import type { ToastItem } from '../lib/toast/toast';

const tones: Record<ToastItem['type'], {
  variant: 'default' | 'destructive' | 'success'; extra: string; text: string;
}> = {
  default: { variant: 'default', extra: '', text: 'text-foreground' },
  success: { variant: 'success', extra: '', text: 'text-success-foreground' },
  error: { variant: 'destructive', extra: '', text: 'text-destructive-foreground' },
  warning: { variant: 'default', extra: 'border-warning bg-warning', text: 'text-warning-foreground' },
  info: { variant: 'default', extra: 'border-info bg-info', text: 'text-info-foreground' },
};

export function Toaster(): JSX.Element | null {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  if (!items.length) return null;
  return (
    <View testID="toaster" pointerEvents="box-none" aria-live="polite"
      className="absolute inset-x-0 top-6 z-50 items-center gap-3 px-4">
      {items.map(item => {
        const { variant, extra, text } = tones[item.type];
        return (
          <Toast key={item.id} testID={`${item.type}-toast`} variant={variant}
            className={`max-w-[356px] p-4 pr-8 ${extra}`}>
            <View className="flex-1 gap-1">
              <ToastTitle className={text}>{item.title}</ToastTitle>
              {item.description ? <ToastDescription className={text}>{item.description}</ToastDescription> : null}
            </View>
            <ToastClose accessibilityRole="button" accessibilityLabel="Close toast"
              onPress={() => dismissToast(item.id)} />
          </Toast>
        );
      })}
    </View>
  );
}
