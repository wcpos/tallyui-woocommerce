import type { RxStorage } from 'rxdb';
import { createStorage } from './storage';

// One SQLite worker per page, ADR-061.
let storage: RxStorage<any, any> | undefined;

export function appStorage(): RxStorage<any, any> {
  return storage ??= createStorage();
}
