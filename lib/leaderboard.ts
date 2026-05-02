import "server-only";

import type { RankedResultEntry, ResultEntry } from "@/types/game";

const MAX_ENTRIES = 200;
const STORAGE_KEY = "still-here:leaderboard:royal-rumble";

let inMemoryStore: ResultEntry[] = [];

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

async function readEntries(): Promise<ResultEntry[]> {
  if (isKvConfigured()) {
    return (await kvGet<ResultEntry[]>(STORAGE_KEY)) ?? [];
  }

  return inMemoryStore;
}

async function writeEntries(entries: ResultEntry[]): Promise<void> {
  if (isKvConfigured()) {
    await kvSet(STORAGE_KEY, entries);
    return;
  }

  // Local dev fallback only. This is not persistent and will not survive
  // Vercel serverless cold starts or multiple instances.
  inMemoryStore = entries;
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

function normalizeLeaderboardName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export async function saveLeaderboardEntry(entry: ResultEntry): Promise<{
  entry: ResultEntry;
  updated: boolean;
}> {
  const currentEntries = await readEntries();
  const normalizedName = normalizeLeaderboardName(entry.playerName);
  const existingIndex = currentEntries.findIndex(
    (currentEntry) => normalizeLeaderboardName(currentEntry.playerName) === normalizedName,
  );

  if (existingIndex === -1) {
    const nextEntries = [entry, ...currentEntries].slice(0, MAX_ENTRIES);
    await writeEntries(nextEntries);

    return {
      entry,
      updated: true,
    };
  }

  const existingEntry = currentEntries[existingIndex];

  if (entry.score > existingEntry.score) {
    const nextEntries = [...currentEntries];
    nextEntries[existingIndex] = entry;
    await writeEntries(nextEntries.slice(0, MAX_ENTRIES));

    return {
      entry,
      updated: true,
    };
  }

  return {
    entry: existingEntry,
    updated: false,
  };
}

export async function getRankedLeaderboard(): Promise<RankedResultEntry[]> {
  const entries = await readEntries();
  return rankEntries(entries);
}
