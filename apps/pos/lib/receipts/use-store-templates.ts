import { useEffect, useRef, useState } from 'react';
import type { ReceiptTemplate, ReceiptTemplateKind, SyncContext, TallyConnector } from '@tallyui/core';

export type TemplateKind = ReceiptTemplateKind;
export type StoreTemplatesState =
  | { status: 'loading' }
  | { status: 'ready'; templates: ReceiptTemplate[] }
  | { status: 'error'; message: string };

// One object, so a connector without templates settles instead of re-rendering.
const NO_TEMPLATES: StoreTemplatesState = { status: 'ready', templates: [] };

export function useStoreTemplates(connector: TallyConnector | undefined, context: () => SyncContext, kind: TemplateKind): StoreTemplatesState {
  const [state, setState] = useState<StoreTemplatesState>({ status: 'loading' });
  const latest = useRef(context);
  latest.current = context;
  useEffect(() => {
    if (!connector?.receiptTemplates) {
      setState(NO_TEMPLATES);
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    connector.receiptTemplates(latest.current(), kind).then(
      templates => { if (!cancelled) setState({ status: 'ready', templates }); },
      error => { if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }); },
    );
    return () => { cancelled = true; };
  }, [connector, kind]);
  return state;
}
