import { kv } from '@vercel/kv';

export async function get(key) {
  return kv.get(key);
}

export async function set(key, value, options) {
  return kv.set(key, value, options);
}
