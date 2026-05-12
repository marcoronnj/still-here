import "server-only";

import { normalizeNameForLookup } from "@/types/game";
import type { LeaderboardSnapshot, RankedResultEntry, ResultEntry } from "@/types/game";

const MAX_ENTRIES = 200;
export const LEADERBOARD_STORAGE_KEY = "still-here:leaderboard:royal-rumble";

let inMemoryStore: ResultEntry[] = [];

export type LeaderboardStorage = "redis-rest" | "memory";

export type LeaderboardDebugInfo = {
  storage: LeaderboardStorage;
  key: typeof LEADERBOARD_STORAGE_KEY;
  count: number;
};

type RedisAdapter = {
  storage: "redis-rest";
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
};

type RedisEnv = {
  url: string;
  token: string;
};

type RedisRestResponse<T> = {
  result?: T;
  error?: string;
};

export function getRedisEnv(): RedisEnv | null {
  const candidates = [
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    ["STORAGE_REST_API_URL", "STORAGE_REST_API_TOKEN"],
  ] as const;

  for (const [urlKey, tokenKey] of candidates) {
    const url = process.env[urlKey];
    const token = process.env[tokenKey];

    if (url && token) {
      return { url, token };
    }
  }

  return null;
}

async function redisCommand<T>(command: readonly unknown[]): Promise<T | null> {
  const redisEnv = getRedisEnv();

  if (!redisEnv) {
    return null;
  }

  const response = await fetch(redisEnv.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisEnv.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as RedisRestResponse<T> | null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error ?? `Upstash Redis REST request failed with ${response.status}.`);
  }

  return payload && "result" in payload ? (payload.result ?? null) : null;
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const result = await redisCommand<string | T>(["GET", key]);

  if (typeof result !== "string") {
    return result as T | null;
  }

  try {
    return JSON.parse(result) as T;
  } catch {
    return result as T;
  }
}

export async function redisSet<T>(key: string, value: T): Promise<void> {
  await redisCommand<string>(["SET", key, JSON.stringify(value)]);
}

async function createRedisAdapter(): Promise<RedisAdapter | null> {
  const redisEnv = getRedisEnv();

  if (!redisEnv) {
    return null;
  }

  return {
    storage: "redis-rest",
    get: redisGet,
    set: redisSet,
  };
}

async function readEntries(): Promise<{
  entries: ResultEntry[];
  storage: LeaderboardStorage;
}> {
  const redis = await createRedisAdapter();

  if (redis) {
    return {
      entries: (await redis.get<ResultEntry[]>(LEADERBOARD_STORAGE_KEY)) ?? [],
      storage: redis.storage,
    };
  }

  return {
    entries: inMemoryStore,
    storage: "memory",
  };
}

async function writeEntries(entries: ResultEntry[]): Promise<LeaderboardStorage> {
  const redis = await createRedisAdapter();

  if (redis) {
    await redis.set(LEADERBOARD_STORAGE_KEY, entries);
    return redis.storage;
  }

  // Local dev fallback only. This is not persistent and will not survive
  // Vercel serverless cold starts or multiple instances.
  console.warn("Leaderboard store is using in-memory fallback. Upstash Redis is not configured.");
  inMemoryStore = entries;
  return "memory";
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

      return right.updatedAt.localeCompare(left.updatedAt);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function getNormalizedName(entry: ResultEntry): string {
  return entry.normalizedName || normalizeNameForLookup(entry.playerName);
}

function isPreferredEntry(candidate: ResultEntry, current: ResultEntry): boolean {
  if (candidate.score !== current.score) {
    return candidate.score > current.score;
  }

  if (candidate.totalAnswered !== current.totalAnswered) {
    return candidate.totalAnswered > current.totalAnswered;
  }

  return candidate.updatedAt > current.updatedAt;
}

function normalizeEntryIdentity(entry: ResultEntry): ResultEntry {
  const normalizedName = getNormalizedName(entry);

  return entry.normalizedName === normalizedName ? entry : { ...entry, normalizedName };
}

function toStoredEntry(entry: RankedResultEntry): ResultEntry {
  return {
    playerId: entry.playerId,
    playerName: entry.playerName,
    normalizedName: entry.normalizedName,
    score: entry.score,
    totalAnswered: entry.totalAnswered,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function collapseEntriesByName(entries: ResultEntry[]): {
  entries: ResultEntry[];
  changed: boolean;
} {
  const entriesByName = new Map<string, ResultEntry>();
  let changed = false;

  for (const rawEntry of entries) {
    const entry = normalizeEntryIdentity(rawEntry);
    const normalizedName = getNormalizedName(entry);

    if (!normalizedName) {
      changed = true;
      continue;
    }

    if (entry !== rawEntry) {
      changed = true;
    }

    const existingEntry = entriesByName.get(normalizedName);

    if (!existingEntry) {
      entriesByName.set(normalizedName, entry);
      continue;
    }

    changed = true;

    if (isPreferredEntry(entry, existingEntry)) {
      entriesByName.set(normalizedName, entry);
    }
  }

  const collapsedEntries = rankEntries([...entriesByName.values()])
    .slice(0, MAX_ENTRIES)
    .map(toStoredEntry);

  if (collapsedEntries.length !== entries.length) {
    changed = true;
  }

  return {
    entries: collapsedEntries,
    changed,
  };
}

export async function saveLeaderboardEntry(entry: ResultEntry): Promise<{
  entry: ResultEntry;
  saved: boolean;
  isPersonalBest: boolean;
  debug: LeaderboardDebugInfo;
}> {
  const { entries: currentEntries } = await readEntries();
  const { entries: cleanedEntries } = collapseEntriesByName(currentEntries);
  const normalizedEntry = normalizeEntryIdentity(entry);
  const existingIndex = cleanedEntries.findIndex(
    (currentEntry) => getNormalizedName(currentEntry) === normalizedEntry.normalizedName,
  );

  if (existingIndex === -1) {
    const nextEntries = [normalizedEntry, ...cleanedEntries].slice(0, MAX_ENTRIES);
    const savedStorage = await writeEntries(nextEntries);

    return {
      entry: normalizedEntry,
      saved: true,
      isPersonalBest: true,
      debug: {
        storage: savedStorage,
        key: LEADERBOARD_STORAGE_KEY,
        count: nextEntries.length,
      },
    };
  }

  const existingEntry = cleanedEntries[existingIndex];

  if (entry.score > existingEntry.score) {
    const nextEntries = [...cleanedEntries];
    nextEntries[existingIndex] = {
      ...normalizedEntry,
      createdAt: existingEntry.createdAt,
    };
    const trimmedEntries = nextEntries.slice(0, MAX_ENTRIES);
    const savedStorage = await writeEntries(trimmedEntries);

    return {
      entry: nextEntries[existingIndex],
      saved: true,
      isPersonalBest: true,
      debug: {
        storage: savedStorage,
        key: LEADERBOARD_STORAGE_KEY,
        count: trimmedEntries.length,
      },
    };
  }

  const savedStorage = await writeEntries(cleanedEntries);

  return {
    entry: existingEntry,
    saved: false,
    isPersonalBest: false,
    debug: {
      storage: savedStorage,
      key: LEADERBOARD_STORAGE_KEY,
      count: cleanedEntries.length,
    },
  };
}

export async function getRankedLeaderboard(): Promise<{
  entries: RankedResultEntry[];
  debug: LeaderboardDebugInfo;
}> {
  const { entries } = await readEntries();
  const { entries: cleanedEntries } = collapseEntriesByName(entries);
  const savedStorage = await writeEntries(cleanedEntries);

  return {
    entries: rankEntries(cleanedEntries),
    debug: {
      storage: savedStorage,
      key: LEADERBOARD_STORAGE_KEY,
      count: cleanedEntries.length,
    },
  };
}

export async function getLeaderboardSnapshot(playerName?: string | null): Promise<
  LeaderboardSnapshot & LeaderboardDebugInfo
> {
  const { entries: rankedEntries, debug } = await getRankedLeaderboard();
  const normalizedName = normalizeNameForLookup(playerName);
  const currentPlayerEntry = normalizedName
    ? rankedEntries.find((entry) => getNormalizedName(entry) === normalizedName) ?? null
    : null;

  return {
    top10: rankedEntries.slice(0, 10),
    currentPlayerBest: currentPlayerEntry,
    currentPlayerRank: currentPlayerEntry?.rank ?? null,
    ...debug,
  };
}
