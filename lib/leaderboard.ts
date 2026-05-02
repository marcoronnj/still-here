import "server-only";

import type { GameMode, RankedResultEntry, ResultEntry } from "@/types/game";

const MAX_ENTRIES_PER_MODE = 200;
const STORAGE_PREFIX = "still-here:leaderboard";

const inMemoryStore = new Map<GameMode, ResultEntry[]>();

function getStorageKey(mode: GameMode) {
  return `${STORAGE_PREFIX}:${mode}`;
}

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet<T>(key: string): Promise<T | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`KV get failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    result?: string | null;
  };

  if (!data.result) {
    return null;
  }

  return JSON.parse(data.result) as T;
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("KV env vars are missing.");
  }

  const serialized = JSON.stringify(value);
  const response = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`KV set failed with status ${response.status}.`);
  }
}

async function readEntries(mode: GameMode): Promise<ResultEntry[]> {
  if (isKvConfigured()) {
    return (await kvGet<ResultEntry[]>(getStorageKey(mode))) ?? [];
  }

  return inMemoryStore.get(mode) ?? [];
}

async function writeEntries(mode: GameMode, entries: ResultEntry[]): Promise<void> {
  if (isKvConfigured()) {
    await kvSet(getStorageKey(mode), entries);
    return;
  }

  // Local dev fallback only. This is not persistent and will not survive
  // Vercel serverless cold starts or multiple instances.
  inMemoryStore.set(mode, entries);
}

function rankEntries(entries: ResultEntry[]): RankedResultEntry[] {
  return [...entries]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.totalAnswered !== left.totalAnswered) {
        return right.totalAnswered - left.totalAnswered;
      }

      return right.createdAt.localeCompare(left.createdAt);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export async function saveLeaderboardEntry(entry: ResultEntry): Promise<ResultEntry> {
  const currentEntries = await readEntries(entry.gameMode);
  const nextEntries = [entry, ...currentEntries].slice(0, MAX_ENTRIES_PER_MODE);
  await writeEntries(entry.gameMode, nextEntries);
  return entry;
}

export async function getRankedLeaderboard(mode: GameMode): Promise<RankedResultEntry[]> {
  const entries = await readEntries(mode);
  return rankEntries(entries);
}
