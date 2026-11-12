import type { JSX } from 'react';
import { View } from 'react-native';
import { Path } from 'react-native-svg';
import { Badge, Button, createSvgIcon, Text } from '@tallyui/components';
import type { PaymentMethodDescriptor } from '@tallyui/core';
import { primaryServerHardware, selectedReaderId, smartReaderMethods,
  type RememberedReader, type RememberedReaders, type ServerHardware } from '../../lib/card-readers/smart-readers';
import { StatusDot } from '../status-dot';

export type CardReadersLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; methods: PaymentMethodDescriptor[] };

const CardIcon = createSvgIcon('CardIcon', () => (
  <Path d="M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 2h18M7 15h.01M11 15h2" />
));

function SmartReaderRow({ method, hardware, reader, chosen, onChoose, first }: {
  method: PaymentMethodDescriptor;
  hardware: ServerHardware;
  reader: ServerHardware['readers'][number];
  chosen: RememberedReaders;
  onChoose(methodId: string, reader: RememberedReader): void;
  first: boolean;
}): JSX.Element {
  const id = `smart-reader-${method.id}-${reader.id}`;
  const online = reader.status === 'online';
  const isSelected = reader.id === selectedReaderId(method, chosen[method.id]);
  // v2's phone layout moves actions below the lines; this page targets the wide settings card.
  return (
    <View testID={id} className={`gap-3 py-3${first ? '' : ' border-t border-border'}`}>
      <View className="flex-row items-center gap-3">
        <View className={`size-10 items-center justify-center rounded-lg ${online ? 'bg-success/15' : 'bg-muted'}`}>
          <CardIcon size={18} strokeWidth={1.5} className={online ? 'text-success' : 'text-muted-foreground'} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text numberOfLines={1} className="text-base font-medium text-foreground">{reader.label}</Text>
          {hardware.lockToDefault && reader.id === hardware.defaultReader && (
            <Text testID={`${id}-identifiers`} className="text-muted-foreground text-sm">Set by the store</Text>
          )}
          <StatusDot testID={`${id}-status`} tone={online ? 'success' : 'muted'} label={online ? 'Online' : 'Offline'} />
        </View>
        <Badge testID={`${id}-tag`} variant="secondary" className="max-w-32" label={method.title} />
        <View className="shrink-0 flex-row items-center justify-end gap-2">
          {isSelected ? (
            <View testID={`${id}-selected`} aria-selected className="h-9 justify-center rounded-md border border-selected bg-selected px-3">
              <Text className="text-sm font-medium text-selected-foreground">Selected</Text>
            </View>
          ) : online && !hardware.lockToDefault ? (
            <Button testID={`${id}-use`} variant="ghost" size="sm" onPress={() => onChoose(method.id, { id: reader.id, label: reader.label })}>
              <Text>Use this reader</Text>
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function CardReadersSettings({ load, chosen, onChoose }: {
  load: CardReadersLoad;
  chosen: RememberedReaders;
  onChoose(methodId: string, reader: RememberedReader): void;
}): JSX.Element {
  if (load.status === 'loading') return <Text testID="card-readers-loading" className="text-muted-foreground text-sm">Loading…</Text>;
  if (load.status === 'error') return <Text testID="card-readers-error" className="text-destructive text-sm">Could not load the store's card readers: {load.message}</Text>;
  const methods = smartReaderMethods(load.methods);
  if (!methods.length) return <Text testID="card-readers-none" className="text-muted-foreground text-sm">No card readers are set up for this store. Add them on the gateway's WooCommerce page.</Text>;
  const rows = methods.flatMap(method => {
    const hardware = primaryServerHardware(method)!;
    return hardware.readers.map(reader => ({ method, hardware, reader }));
  });
  return (
    <View testID="card-readers-smart" className="gap-1">
      <Text role="heading" aria-level={2} className="text-base font-semibold text-foreground">Smart readers</Text>
      <Text className="text-muted-foreground text-xs">The store drives these over the network. This till pays with the selected one.</Text>
      <View>
        {rows.map((row, index) => <SmartReaderRow key={`${row.method.id}-${row.reader.id}`} {...row}
          first={index === 0} chosen={chosen} onChoose={onChoose} />)}
      </View>
    </View>
  );
}
