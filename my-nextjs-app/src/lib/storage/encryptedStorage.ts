import { openDB, IDBPDatabase } from 'idb';
import * as SWR from 'swr';
import { encryptTokens, decryptTokens } from '@/utils/encrypt'; // Assuming these utilities exist

const dbPromise = openDB('ses-db', 1, {
  upgrade(db: IDBPDatabase) {
    db.createObjectStore('cache');
  },
});

export async function encryptAndStore(key: string, data: any) {
  const encrypted = await encryptTokens(data);
  const db = await dbPromise;
  await db.put('cache', encrypted, key);
}

export async function decryptAndRetrieve(key: string) {
  const db = await dbPromise;
  const encrypted = await db.get('cache', key);
  if (!encrypted) return null;
  return decryptTokens(encrypted);
}

export const encryptedFetcher = async (url: string) => {
  const cacheKey = `swr-${url}`;
  const cached = await decryptAndRetrieve(cacheKey);
  if (cached) return cached;

  const response = await fetch(url);
  const data = await response.json();
  await encryptAndStore(cacheKey, data);
  return data;
};
