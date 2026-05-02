import "server-only";

import type { LeaderboardSnapshot, RankedResultEntry, ResultEntry } from "@/types/game";

const MAX_ENTRIES = 200;
const STORAGE_KEY = "still-here:leaderboard:royal-rumble";

let inMemoryStore: ResultEntry[] = [];

type RedisAdapter = {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
};

async function createRedisAdapter(): Promise<RedisAdapter | null> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier);") as (
      specifier: string,
    ) => Promise<{
      Redis?: {
        fromEnv: () => {
          get: <T>(key: string) => Promise<T | null>;
          set: (key: string, value: unknown) => Promise<unknown>;
        };
      };
    }>;
    const redisModule = await dynamicImport("@upstash/redis");

    if (!redisModule.Redis) {
      return null;
    }

    const redis = redisModule.Redis.fromEnv();

    return {
      async get<T>(key: string) {
        return redis.get<T>(key);
      },
      async set<T>(key: string, value: T) {
        await redis.set(key, value);
      },
    };
  } catch {
    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!restUrl || !restToken) {
      return null;
    }

    return {
      async get<T>(key: string) {
        const response = await fetch(`${restUrl}/get/${encodeURIComponent(key)}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${restToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Upstash REST get failed with status ${response.status}.`);
        }

        const payload = (await response.json()) as {
          result?: T | null;
        };

        return payload.result ?? null;
      },
      async set<T>(key: string, value: T) {
        const response = await fetch(`${restUrl}/set/${encodeURIComponent(key)}`, {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${restToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(value),
        });

        if (!response.ok) {
          throw new Error(`Upstash REST set failed with status ${response.status}.`);
        }
      },
    };
  }
}

async function readEntries(): Promise<ResultEntry[]> {
  const redis = await createRedisAdapter();

  if (redis) {
    return (await redis.get<ResultEntry[]>(STORAGE_KEY)) ?? [];
  }

  return inMemoryStore;
}

async function writeEntries(entries: ResultEntry[]): Promise<void> {
  const redis = await createRedisAdapter();

  if (redis) {
    await redis.set(STORAGE_KEY, entries);
    return;
  }

  // Local dev fallback only. This is not persistent and will not survive
  // Vercel serverless cold starts or multiple instances.
  console.warn("Leaderboard store is using in-memory fallback. Upstash Redis is not configured.");
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
}> {
  const currentEntries = await readEntries();
  const existingIndex = currentEntries.findIndex(
    (currentEntry) => currentEntry.playerId === entry.playerId,
  );

  if (existingIndex === -1) {
    const nextEntries = [entry, ...currentEntries].slice(0, MAX_ENTRIES);
    await writeEntries(nextEntries);

    return {
      entry,
      saved: true,
      isPersonalBest: true,
    };
  }

  const existingEntry = currentEntries[existingIndex];

  if (entry.score > existingEntry.score) {
    const nextEntries = [...currentEntries];
    nextEntries[existingIndex] = {
      ...entry,
      createdAt: existingEntry.createdAt,
    };
    await writeEntries(nextEntries.slice(0, MAX_ENTRIES));

    return {
      entry: nextEntries[existingIndex],
      saved: true,
      isPersonalBest: true,
    };
  }

  return {
    entry: existingEntry,
    saved: false,
    isPersonalBest: false,
  };
}

export async function getRankedLeaderboard(): Promise<RankedResultEntry[]> {
  const entries = await readEntries();
  return rankEntries(entries);
}

export async function getLeaderboardSnapshot(playerId?: string | null): Promise<LeaderboardSnapshot> {
  const rankedEntries = await getRankedLeaderboard();
  const currentPlayerEntry = playerId
    ? rankedEntries.find((entry) => entry.playerId === playerId) ?? null
    : null;

  return {
    top10: rankedEntries.slice(0, 10),
    currentPlayerBest: currentPlayerEntry,
    currentPlayerRank: currentPlayerEntry?.rank ?? null,
  };
}
