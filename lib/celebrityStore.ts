import "server-only";

import { italianCelebrities } from "@/lib/italianCelebrities";
import { refreshCelebrityDataset } from "@/lib/celebrityRefresh";
import type { Celebrity } from "@/types/celebrity";

const CELEBRITIES_KEY = "still-here:celebrities";

let inMemoryCelebrities: Celebrity[] | null = null;

type KvAdapter = {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
};

function cloneCelebrities(celebrities: Celebrity[]) {
  return celebrities.map((celebrity) => ({ ...celebrity }));
}

async function createRestKvAdapter(): Promise<KvAdapter | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    async get<T>(key: string) {
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
    },
    async set<T>(key: string, value: T) {
      const serialized = JSON.stringify(value);
      const response = await fetch(
        `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`KV set failed with status ${response.status}.`);
      }
    },
  };
}

async function createPackageKvAdapter(): Promise<KvAdapter | null> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier);") as (
      specifier: string,
    ) => Promise<{ kv?: { get: <T>(key: string) => Promise<T | null>; set: (key: string, value: unknown) => Promise<void> } }>;

    const kvModule = await dynamicImport("@vercel/kv");

    if (!kvModule.kv) {
      return null;
    }

    return {
      async get<T>(key: string) {
        return kvModule.kv?.get<T>(key) ?? null;
      },
      async set<T>(key: string, value: T) {
        await kvModule.kv?.set(key, value);
      },
    };
  } catch {
    return null;
  }
}

async function getKvAdapter(): Promise<KvAdapter | null> {
  const packageAdapter = await createPackageKvAdapter();

  if (packageAdapter) {
    return packageAdapter;
  }

  return createRestKvAdapter();
}

function isCelebrityArray(value: unknown): value is Celebrity[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object" && "id" in item && "name" in item);
}

export async function getCelebrities(): Promise<Celebrity[]> {
  try {
    const kv = await getKvAdapter();

    if (kv) {
      const stored = await kv.get<Celebrity[]>(CELEBRITIES_KEY);

      if (isCelebrityArray(stored) && stored.length > 0) {
        return cloneCelebrities(stored);
      }
    }
  } catch (error) {
    console.error("Failed to read celebrities from persistent store:", error);
  }

  if (inMemoryCelebrities && inMemoryCelebrities.length > 0) {
    return cloneCelebrities(inMemoryCelebrities);
  }

  return cloneCelebrities(italianCelebrities);
}

export async function updateCelebrityData(celebrities: Celebrity[]): Promise<void> {
  const safeCelebrities = celebrities.length > 0 ? cloneCelebrities(celebrities) : cloneCelebrities(italianCelebrities);

  try {
    const kv = await getKvAdapter();

    if (kv) {
      await kv.set(CELEBRITIES_KEY, safeCelebrities);
      return;
    }
  } catch (error) {
    console.error("Failed to write celebrities to persistent store:", error);
  }

  // TODO: Configure Vercel KV or another persistent database in production.
  // This in-memory fallback is useful for local/manual testing only and will
  // not survive Vercel serverless restarts.
  inMemoryCelebrities = safeCelebrities;
}

export async function refreshCelebrities() {
  const currentCelebrities = await getCelebrities();
  const refreshResult = await refreshCelebrityDataset(currentCelebrities);
  const nextCelebrities =
    refreshResult.celebrities.length > 0 ? refreshResult.celebrities : currentCelebrities;

  try {
    await updateCelebrityData(nextCelebrities);
  } catch (error) {
    console.error("Failed to persist refreshed celebrities:", error);
  }

  return {
    ...refreshResult,
    celebrities: nextCelebrities,
  };
}
