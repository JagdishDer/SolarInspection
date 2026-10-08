import * as Crypto from 'expo-crypto';

/**
 * Client-side UUID used for every primary key so entities can be created
 * offline and upserted later (idempotent sync).
 */
export function uuid(): string {
  return Crypto.randomUUID();
}
