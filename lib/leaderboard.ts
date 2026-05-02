import "server-only";

import type { LeaderboardSnapshot, RankedResultEntry, ResultEntry } from "@/types/game";

const MAX_ENTRIES = 200;
export const LEADERBOARD_STORAGE_KEY = "still-here:leaderboard:royal-rumble";

let inMemoryStore: ResultEntry[] = [];

export type LeaderboardStorage = "redis" | "memory";

export type LeaderboardDebugInfo = {
  storage: LeaderboardStorage;
  key: typeof LEADERBOARD_STORAGE_KEY;
  count: number;
};

type RedisAdapter = {
  storage: "redis";
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
};

type RedisEnv = {
  url: string;
  token: string;
};

type RedisModule = {
  Redis?: {
    fromEnv: () => {
      get: <T>(key: string) => Promise<T | null>;
      set: (key: string, value: unknown) => Promise<unknown>;
    };
  };
};

function getRedisEnv(): RedisEnv | null {
  const candidates = [
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    ["STORAGE_REST_API_URL", "STORAGE_REST_API_TOKEN"],
    ["STORAGE_REDIS_REST_URL", "STORAGE_REDIS_REST_TOKEN"],
    ["STORAGE_KV_REST_API_URL", "STORAGE_KV_REST_API_TOKEN"],
    ["STORAGE_UPSTASH_REDIS_REST_URL", "STORAGE_UPSTASH_REDIS_REST_TOKEN"],
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

async function createRedisAdapter(): Promise<RedisAdapter | null> {
  const redisEnv = getRedisEnv();

  if (!redisEnv) {
    return null;
  }

  try {
    const dynamicImport = new Function("specifier", "return import(specifier);") as (
      specifier: string,
    ) => Promise<RedisModule>;
    const redisModule = await dynamicImport("@upstash/redis");

    if (!redisModule.Redis) {
      throw new Error("@upstash/redis did not export Redis.");
    }

    process.env.UPSTASH_REDIS_REST_URL = redisEnv.url;
    process.env.UPSTASH_REDIS_REST_TOKEN = redisEnv.token;

    const redis = redisModule.Redis.fromEnv();

    return {
      storage: "redis",
      async get<T>(key: string) {
        return redis.get<T>(key);
      },
      async set<T>(key: string, value: T) {
        await redis.set(key, value);
      },
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Redis leaderboard storage is configured but unavailable: ${error.message}`
        : "Redis leaderboard storage is configured but unavailable.",
    );
  }
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

export async function saveLeaderboardEntry(entry: ResultEntry): Promise<{
  entry: ResultEntry;
  saved: boolean;
  isPersonalBest: boolean;
  debug: LeaderboardDebugInfo;
}> {
  const { entries: currentEntries, storage } = await readEntries();
  const existingIndex = currentEntries.findIndex(
    (currentEntry) => currentEntry.playerId === entry.playerId,
  );

  if (existingIndex === -1) {
    const nextEntries = [entry, ...currentEntries].slice(0, MAX_ENTRIES);
    const savedStorage = await writeEntries(nextEntries);

    return {
      entry,
      saved: true,
      isPersonalBest: true,
      debug: {
        storage: savedStorage,
        key: LEADERBOARD_STORAGE_KEY,
        count: nextEntries.length,
      },
    };
  }

  const existingEntry = currentEntries[existingIndex];

  if (entry.score > existingEntry.score) {
    const nextEntries = [...currentEntries];
    nextEntries[existingIndex] = {
      ...entry,
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

  return {
    entry: existingEntry,
    saved: false,
    isPersonalBest: false,
    debug: {
      storage,
      key: LEADERBOARD_STORAGE_KEY,
      count: currentEntries.length,
    },
  };
}

export async function getRankedLeaderboard(): Promise<{
  entries: RankedResultEntry[];
  debug: LeaderboardDebugInfo;
}> {
  const { entries, storage } = await readEntries();

  return {
    entries: rankEntries(entries),
    debug: {
      storage,
      key: LEADERBOARD_STORAGE_KEY,
      count: entries.length,
    },
  };
}

export async function getLeaderboardSnapshot(playerId?: string | null): Promise<
  LeaderboardSnapshot & LeaderboardDebugInfo
> {
  const { entries: rankedEntries, debug } = await getRankedLeaderboard();
  const currentPlayerEntry = playerId
    ? rankedEntries.find((entry) => entry.playerId === playerId) ?? null
    : null;

  return {
    top10: rankedEntries.slice(0, 10),
    currentPlayerBest: currentPlayerEntry,
    currentPlayerRank: currentPlayerEntry?.rank ?? null,
    ...debug,
  };
}
