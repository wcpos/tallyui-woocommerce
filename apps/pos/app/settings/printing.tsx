import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Text } from '@tallyui/components';
import type { PrinterProfileCollection } from '@tallyui/pos';
import { PrintingSettings } from '../../components/settings/printing-settings';
import { useSession } from '../../lib/auth/session-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';
import { deletePrinterProfile, savePrinterProfile, setDefaultPrinterProfile, usePrinterProfiles } from '../../lib/printing/printer-profiles';
import { useStoreTemplates } from '../../lib/receipts/use-store-templates';

export default function PrintingSettingsRoute() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const latest = useRef(session);
  latest.current = session;
  const connector = catalogue?.connector;
  const context = () => ({
    connectorId: connector!.id,
    baseUrl: latest.current!.site.wcposApiUrl,
    headers: connector!.auth.getHeaders({ token: latest.current!.tokens.accessToken }),
  });
  const receipt = useStoreTemplates(connector, context, 'receipt');
  const report = useStoreTemplates(connector, context, 'report');
  const closure = useStoreTemplates(connector, context, 'closure');
  const profiles = usePrinterProfiles(catalogue?.printerProfiles);
  const [printersError, setPrintersError] = useState<string>();
  // A refused command shows its message under the Printers section; the next one clears it.
  const run = (command: (collection: PrinterProfileCollection) => Promise<void>) => {
    setPrintersError(undefined);
    command(catalogue!.printerProfiles).catch((cause: unknown) => setPrintersError((cause as Error).message));
  };
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
  );
  return <PrintingSettings templates={{ receipt, report, closure }} profiles={profiles} printersError={printersError}
    onSavePrinter={profile => run(collection => savePrinterProfile(collection, profile))}
    onSetDefault={id => run(collection => setDefaultPrinterProfile(collection, id))}
    onDeletePrinter={id => run(collection => deletePrinterProfile(collection, id))} />;
}
