import { promises as fs } from 'fs';
import path from 'path';
import type { TokenCacheEntry, RateLimitState } from './enhanced-token-manager';

const DATA_DIR = path.join(process.cwd(), '.cache');
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json');
const RATE_FILE = path.join(DATA_DIR, 'rate-limits.json');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson(file: string): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeJson(file: string, data: Record<string, any>): Promise<void> {
  await ensureDir();
  if (Object.keys(data).length === 0) {
    try { await fs.unlink(file); } catch {}
    return;
  }
  await fs.writeFile(file, JSON.stringify(data), 'utf8');
}

export async function readToken(key: string): Promise<TokenCacheEntry | null> {
  const data = await readJson(TOKEN_FILE);
  return data[key] || null;
}

export async function writeToken(key: string, value: TokenCacheEntry | null): Promise<void> {
  const data = await readJson(TOKEN_FILE);
  if (value) data[key] = value; else delete data[key];
  await writeJson(TOKEN_FILE, data);
}

export async function readRateLimit(key: string): Promise<RateLimitState | null> {
  const data = await readJson(RATE_FILE);
  return data[key] || null;
}

export async function writeRateLimit(key: string, value: RateLimitState | null): Promise<void> {
  const data = await readJson(RATE_FILE);
  if (value) data[key] = value; else delete data[key];
  await writeJson(RATE_FILE, data);
}

export async function clearTokenStore(): Promise<void> {
  await writeJson(TOKEN_FILE, {});
}

export async function clearRateLimitStore(): Promise<void> {
  await writeJson(RATE_FILE, {});
}
