export function taxClassOptions(slugs: readonly string[] | undefined): Array<{ id: string; label: string }> {
  // standard is WooCommerce's empty class, which the charge form offers as "No class".
  return (slugs ?? []).filter(slug => slug !== 'standard').map(id => ({
    id,
    label: id.replace(/-/g, ' ').replace(/^./, letter => letter.toUpperCase()),
  }));
}
