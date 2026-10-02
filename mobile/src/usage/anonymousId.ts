/**
 * Persistent anonymous client identity — no login.
 * Server is authoritative for quota; this id is only an identity handle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { newId } from '../lib/id';

const KEY = 'dooji.anonymous_client_id.v1';

let cached: string | null = null;

export async function getAnonymousClientId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch {
    // fall through
  }
  const id = newId('anon');
  cached = id;
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    // in-memory only for this session
  }
  return id;
}

/** Test helper */
export function resetAnonymousClientIdForTests(): void {
  cached = null;
}
