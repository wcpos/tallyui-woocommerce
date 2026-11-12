import { afterEach, beforeEach, expect, test } from 'vitest';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPrinterProfileCollection, SYSTEM_PRINTER_ID, type PrinterProfile, type PrinterProfileCollection } from '@tallyui/pos';
import { deletePrinterProfile, listPrinterProfiles, newPrinterId, savePrinterProfile,
  setDefaultPrinterProfile } from '../lib/printing/printer-profiles';

let db: RxDatabase;
let collection: PrinterProfileCollection;

beforeEach(async () => {
  db = await createRxDatabase({ name: `printers_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  collection = await addPrinterProfileCollection(db);
});
afterEach(async () => { await db.close(); });

function printer(id: string, name: string, isDefault = false): PrinterProfile {
  return { id, name, connectionType: 'network', vendor: 'epson', address: '192.168.1.50', port: 8008, columns: 42, isDefault };
}

async function defaults(): Promise<Record<string, boolean | undefined>> {
  return Object.fromEntries((await listPrinterProfiles(collection)).map(profile => [profile.id, profile.isDefault]));
}

test('saving a default printer demotes the others', async () => {
  await savePrinterProfile(collection, printer('a', 'Front counter', true));
  await savePrinterProfile(collection, printer('b', 'Kitchen', true));
  expect(await defaults()).toEqual({ a: false, b: true });
  await savePrinterProfile(collection, { ...printer('a', 'Front till'), isDefault: false });
  expect(await defaults()).toEqual({ a: false, b: true });
  expect((await collection.findOne('a').exec())?.name).toBe('Front till');
});

test('setDefaultPrinterProfile moves the default', async () => {
  await savePrinterProfile(collection, printer('a', 'Front counter', true));
  await savePrinterProfile(collection, printer('b', 'Kitchen'));
  await savePrinterProfile(collection, printer('c', 'Bar'));
  await setDefaultPrinterProfile(collection, 'c');
  expect(await defaults()).toEqual({ a: false, b: false, c: true });
  await expect(setDefaultPrinterProfile(collection, 'gone')).rejects.toThrow();
});

test('deletePrinterProfile refuses the Print Dialog', async () => {
  await savePrinterProfile(collection, printer('a', 'Front counter', true));
  await expect(deletePrinterProfile(collection, SYSTEM_PRINTER_ID)).rejects.toThrow('cannot be deleted');
  await deletePrinterProfile(collection, 'a');
  expect(await listPrinterProfiles(collection)).toEqual([]);
});

test('listPrinterProfiles puts the default first', async () => {
  await savePrinterProfile(collection, printer('a', 'Bar'));
  await savePrinterProfile(collection, printer('b', 'Kitchen', true));
  await savePrinterProfile(collection, printer('c', 'Annex'));
  expect((await listPrinterProfiles(collection)).map(profile => profile.name)).toEqual(['Kitchen', 'Annex', 'Bar']);
});

test('newPrinterId fits the schema and does not repeat', () => {
  const ids = new Set(Array.from({ length: 50 }, newPrinterId));
  expect(ids.size).toBe(50);
  for (const id of ids) expect(id).toMatch(/^printer-[0-9a-z]+-[0-9a-z]+$/);
  for (const id of ids) expect(id.length).toBeLessThanOrEqual(36);
});
