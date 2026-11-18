/** v2 hooks/use-customer-name-format: the name, else the email, else Guest for a guest (no id), else "ID: {id}". */
export function orderCustomerName(customer: { id?: string; name?: string; email?: string } | null | undefined): string {
  return customer?.name || customer?.email || (customer?.id ? `ID: ${customer.id}` : 'Guest');
}
