import { useEffect, useRef, useState } from 'react';
import { createLogger, type CustomerSummary } from '@tallyui/pos';
// v2 logs cart actions under ['wcpos', 'pos', 'cart'] (pos/hooks/use-add-*.ts), each after the action succeeds.
export const cartLogger = createLogger('cart');
// v2 use-add-customer.ts:52-54,77: a guest (no customer) is "Guest".
export function logCustomerAssigned(customer: CustomerSummary | null): void {
  cartLogger.info(`Customer assigned: ${customer?.name.trim() || 'Guest'}`, customer ? { customerId: customer.id } : { isGuest: true });
}
export function useAssignCustomer(sale: { setCustomer(customer: CustomerSummary | null): void; order: { customer?: CustomerSummary | null } }): (customer: CustomerSummary | null) => void {
  const pending = useRef<CustomerSummary | null>(null);
  const [attempt, setAttempt] = useState(0);
  // v2 use-add-customer.ts:70-75 skips the log when the assignment fails.
  useEffect(() => {
    if (attempt === 0) return;
    if ((sale.order.customer?.id ?? null) === (pending.current?.id ?? null)) logCustomerAssigned(pending.current);
    pending.current = null;
  }, [attempt]);
  return customer => { pending.current = customer; setAttempt(value => value + 1); sale.setCustomer(customer); };
}
