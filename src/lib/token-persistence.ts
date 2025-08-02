import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const DATA_DIR = process.env.CACHE_DIR || path.join(os.tmpdir(), '.cache');
const memoryCache = new Map<string, string>();
let directoryUsable = true;

async function ensureDir() {
  if (!directoryUsable) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    directoryUsable = false;
    console.warn(`Token persistence disabled: unable to create ${DATA_DIR}`, err);
  }
}

export async function saveToken(key: string, token: string): Promise<void> {
  memoryCache.set(key, token);
  await ensureDir();
  if (!directoryUsable) return;
  try {
    await fs.writeFile(path.join(DATA_DIR, key), token, 'utf8');
  } catch (err) {
    directoryUsable = false;
    console.warn(`Token persistence disabled: unable to write to ${DATA_DIR}`, err);
  }
}

export async function loadToken(key: string): Promise<string | null> {
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }
  await ensureDir();
  if (!directoryUsable) {
    return null;
  }
  try {
    const token = await fs.readFile(path.join(DATA_DIR, key), 'utf8');
    memoryCache.set(key, token);
    return token;
  } catch {
    return null;
  }
}
