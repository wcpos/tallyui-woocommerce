export interface TabWhoInput {
  customerName?: string | null;
  lines: readonly { name: string }[];
  fees?: readonly { name: string }[];
  shipping?: readonly { name: string }[];
}

/** What a cashier recognises a cart by: the customer, or else its contents (WCPOS v2 tab-who.ts). */
export function tabWho(input: TabWhoInput): string {
  const customer = input.customerName?.trim();
  if (customer) return customer;
  const entries: { kind: 'line' | 'fee' | 'shipping'; name: string }[] = [];
  const add = (kind: 'line' | 'fee' | 'shipping', rows: readonly { name: string }[] = []) => {
    for (const row of rows) {
      const name = row.name.trim();
      if (name) entries.push({ kind, name });
    }
  };
  add('line', input.lines);
  add('fee', input.fees);
  add('shipping', input.shipping);
  if (entries.length === 0) return 'Guest';
  if (entries.length > 1) return `Guest · ${entries.length} items`;
  const [only] = entries;
  return only.kind === 'shipping' ? `Guest · ${only.name} shipping` : `Guest · ${only.name}`;
}
