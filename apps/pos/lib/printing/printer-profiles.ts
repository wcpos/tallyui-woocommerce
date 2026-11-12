import { useEffect, useState } from 'react';
import { SYSTEM_PRINTER_ID, type PrinterProfile, type PrinterProfileCollection } from '@tallyui/pos';

// Ported from v2 packages/query/src/commands/printer-profiles.ts. Local only: `printer_profiles` is never replicated.

function byDefaultThenName(a: PrinterProfile, b: PrinterProfile): number {
  return Number(b.isDefault === true) - Number(a.isDefault === true) || a.name.localeCompare(b.name);
}

function plain(docs: { toMutableJSON(): PrinterProfile }[]): PrinterProfile[] {
  return docs.map(doc => doc.toMutableJSON()).sort(byDefaultThenName);
}

/** The stored printers, the default first, then by name. */
export async function listPrinterProfiles(collection: PrinterProfileCollection): Promise<PrinterProfile[]> {
  return plain(await collection.find().exec());
}

async function demoteAllBut(collection: PrinterProfileCollection, id: string): Promise<void> {
  const others = (await collection.find().exec()).filter(doc => doc.id !== id && doc.isDefault === true);
  await Promise.all(others.map(doc => doc.incrementalPatch({ isDefault: false })));
}

/** Upserts by id; a new default demotes every other stored printer (v2 save). */
export async function savePrinterProfile(collection: PrinterProfileCollection, profile: PrinterProfile): Promise<void> {
  if (profile.isDefault) await demoteAllBut(collection, profile.id);
  await collection.upsert(profile);
}

/** That printer becomes the default, the rest are not (v2 set default). */
export async function setDefaultPrinterProfile(collection: PrinterProfileCollection, id: string): Promise<void> {
  const doc = await collection.findOne(id).exec();
  if (!doc) throw new Error('That printer is no longer saved on this device.');
  await demoteAllBut(collection, id);
  await doc.incrementalPatch({ isDefault: true });
}

/** Deletes a stored printer; the Print Dialog is built in and is refused (v2 delete). */
export async function deletePrinterProfile(collection: PrinterProfileCollection, id: string): Promise<void> {
  if (id === SYSTEM_PRINTER_ID) throw new Error('The Print Dialog is built in and cannot be deleted.');
  await collection.findOne(id).remove();
}

/** The stored printers, live. */
export function usePrinterProfiles(collection: PrinterProfileCollection | undefined): PrinterProfile[] {
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  useEffect(() => {
    if (!collection) { setProfiles([]); return; }
    const subscription = collection.find().$.subscribe(docs => setProfiles(plain(docs)));
    return () => subscription.unsubscribe();
  }, [collection]);
  return profiles;
}

/** A new profile id, within the schema's 36 characters. */
export function newPrinterId(): string {
  return `printer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
