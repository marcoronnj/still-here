import type { Celebrity } from "@/types/celebrity";

type WikidataSearchResult = {
  id: string;
  label?: string;
  display?: {
    label?: {
      value?: string;
    };
  };
  aliases?: string[];
  description?: string;
};

type WikidataSearchResponse = {
  search?: WikidataSearchResult[];
};

type WikidataTimeClaim = {
  mainsnak?: {
    datavalue?: {
      value?:
        | {
            time?: string;
            id?: string;
          }
        | string;
    };
  };
};

type WikidataEntity = {
  claims?: Record<string, WikidataTimeClaim[] | undefined>;
  sitelinks?: {
    itwiki?: {
      title?: string;
    };
    enwiki?: {
      title?: string;
    };
  };
};

type WikidataEntityResponse = {
  entities?: Record<string, WikidataEntity | undefined>;
};

type RefreshCelebrityResult = {
  celebrities: Celebrity[];
  updatedCount: number;
  unchangedCount: number;
  errors: string[];
};

const REQUEST_DELAY_MS = 250;
const SEARCH_LIMIT = 10;
const MAX_RETRIES = 5;
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const ENTITY_DATA_BASE = "https://www.wikidata.org/wiki/Special:EntityData";
const HUMAN_ENTITY_ID = "Q5";

const ENTITY_OVERRIDES: Record<string, string> = {
  "Achille Lauro": "Q21208625",
  Amadeus: "Q460657",
  Annalisa: "Q2850715",
  Arisa: "Q445698",
  Blanco: "Q105076439",
  Elisa: "Q166164",
  Fiorello: "Q982694",
  "George Foreman": "Q213919",
  Giorgia: "Q260947",
  Ligabue: "Q563699",
  Mahmood: "Q60036307",
  "Michael Madsen": "Q220584",
  Mina: "Q231156",
  Noemi: "Q35109",
  "Paolo Rossi": "Q178628",
  Ultimo: "Q48187976",
};

const PERSON_DESCRIPTION_KEYWORDS = [
  "actor",
  "actress",
  "allenatore",
  "artista",
  "athlete",
  "attore",
  "attrice",
  "autore",
  "calciatore",
  "cantante",
  "coach",
  "comedian",
  "comico",
  "conduttore",
  "conduttrice",
  "dj",
  "director",
  "filosofo",
  "footballer",
  "giornalista",
  "manager",
  "motociclista",
  "musicista",
  "personality",
  "philosopher",
  "political",
  "politician",
  "presenter",
  "presentatrice",
  "rapper",
  "regista",
  "sciatore",
  "scrittore",
  "singer",
  "songwriter",
  "swimmer",
  "tennis",
  "television",
];

const NON_PERSON_DESCRIPTION_KEYWORDS = [
  "album",
  "character",
  "comune",
  "disambiguation",
  "film",
  "given name",
  "municipality",
  "racehorse",
  "ship",
  "song",
  "surname",
  "town",
  "village",
];

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function normalizeCelebrityName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function slugifyCelebrityName(value: string) {
  return normalizeCelebrityName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractYear(claims: WikidataTimeClaim[] | undefined) {
  const value = claims?.[0]?.mainsnak?.datavalue?.value;

  if (!value || typeof value === "string") {
    return null;
  }

  const time = value.time;

  if (!time) {
    return null;
  }

  const match = time.match(/^([+-]\d{4,})-/);

  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function extractEntityId(claims: WikidataTimeClaim[] | undefined) {
  const value = claims?.[0]?.mainsnak?.datavalue?.value;

  if (!value || typeof value === "string") {
    return null;
  }

  return value.id ?? null;
}

function extractImageUrl(claims: WikidataTimeClaim[] | undefined) {
  const value = claims?.[0]?.mainsnak?.datavalue?.value;

  if (!value || typeof value !== "string") {
    return null;
  }

  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(value)}?width=400`;
}

function isHumanEntity(entity: WikidataEntity) {
  return extractEntityId(entity.claims?.P31) === HUMAN_ENTITY_ID;
}

function scoreDescription(description?: string) {
  if (!description) {
    return 0;
  }

  const normalized = normalizeCelebrityName(description);
  let score = 0;

  for (const keyword of PERSON_DESCRIPTION_KEYWORDS) {
    if (normalized.includes(keyword)) {
      score += 5;
    }
  }

  for (const keyword of NON_PERSON_DESCRIPTION_KEYWORDS) {
    if (normalized.includes(keyword)) {
      score -= 8;
    }
  }

  if (normalized.includes("ital")) {
    score += 2;
  }

  return score;
}

async function requestJson<T>(url: string, attempt = 0): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Still-Here-Refresh/1.0",
      },
      cache: "no-store",
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await delay(1000 * (attempt + 1));
      return requestJson<T>(url, attempt + 1);
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
    }

    const json = (await response.json()) as T;
    await delay(REQUEST_DELAY_MS);
    return json;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await delay(1000 * (attempt + 1));
      return requestJson<T>(url, attempt + 1);
    }

    throw error;
  }
}

async function searchEntity(name: string) {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    format: "json",
    language: "it",
    uselang: "it",
    limit: String(SEARCH_LIMIT),
    search: normalizeCelebrityName(name),
    type: "item",
    origin: "*",
  });

  const url = `${WIKIDATA_API}?${params.toString()}`;
  const data = await requestJson<WikidataSearchResponse>(url);
  return data.search ?? [];
}

async function fetchEntity(entityId: string) {
  const url = `${ENTITY_DATA_BASE}/${entityId}.json`;
  const data = await requestJson<WikidataEntityResponse>(url);
  return data.entities?.[entityId];
}

function pickBestMatch(name: string, results: WikidataSearchResult[]) {
  if (results.length === 0) {
    return { matches: [] as WikidataSearchResult[], warning: `No search results for "${name}"` };
  }

  const normalizedTarget = normalizeCelebrityName(name);
  const scoredResults = results
    .map((result) => {
      const candidates = [
        result.label,
        result.display?.label?.value,
        ...(result.aliases ?? []),
      ].filter(Boolean) as string[];
      const hasExact = candidates.some(
        (candidate) => normalizeCelebrityName(candidate) === normalizedTarget,
      );
      const score = (hasExact ? 100 : 0) + scoreDescription(result.description);

      return { result, hasExact, score };
    })
    .sort((left, right) => right.score - left.score);

  const exactMatches = scoredResults.filter((item) => item.hasExact).map((item) => item.result);

  if (exactMatches.length > 1) {
    return {
      matches: exactMatches,
      warning: `Ambiguous exact match for "${name}": ${exactMatches.map((item) => item.id).join(", ")}`,
    };
  }

  if (exactMatches.length === 1) {
    if (results.length > 1) {
      return {
        matches: exactMatches,
        warning: `Multiple candidates for "${name}", selected exact match ${exactMatches[0].id}`,
      };
    }

    return { matches: exactMatches, warning: null };
  }

  const bestFallback = scoredResults[0]?.result;

  if (!bestFallback) {
    return {
      matches: [] as WikidataSearchResult[],
      warning: `No search results for "${name}"`,
    };
  }

  return {
    matches: [bestFallback],
    warning: `No exact label match for "${name}", selected scored result ${bestFallback.id}`,
  };
}

function buildCelebrity(name: string, entity: WikidataEntity): Celebrity {
  const bornYear = extractYear(entity.claims?.P569);
  const diedYear = extractYear(entity.claims?.P570);
  const wikipediaTitle = entity.sitelinks?.itwiki?.title ?? entity.sitelinks?.enwiki?.title ?? name;
  const imageUrl = extractImageUrl(entity.claims?.P18);

  return {
    id: slugifyCelebrityName(name),
    name,
    bornYear,
    diedYear,
    isAlive: diedYear === null,
    wikipediaTitle,
    imageUrl,
  };
}

async function resolveBestEntity(name: string, matches: WikidataSearchResult[]) {
  const candidates = matches.slice(0, 4);
  const warnings: string[] = [];

  for (const candidate of candidates) {
    const entity = await fetchEntity(candidate.id);

    if (!entity) {
      warnings.push(`Missing entity payload for candidate ${candidate.id}`);
      continue;
    }

    if (isHumanEntity(entity)) {
      return { entity, entityId: candidate.id, warning: warnings[0] ?? null };
    }

    warnings.push(`Candidate ${candidate.id} is not a human entity`);
  }

  const fallback = candidates[0];

  if (!fallback) {
    return { entity: null, entityId: null, warning: warnings[0] ?? null };
  }

  const entity = await fetchEntity(fallback.id);

  return {
    entity: entity ?? null,
    entityId: fallback.id,
    warning: warnings[0] ?? null,
  };
}

export async function resolveCelebrityFromWikidata(name: string): Promise<Celebrity> {
  const overrideId = ENTITY_OVERRIDES[name];

  if (overrideId) {
    const entity = await fetchEntity(overrideId);

    if (!entity) {
      throw new Error(`Override entity payload missing for "${name}" (${overrideId})`);
    }

    return buildCelebrity(name, entity);
  }

  const searchResults = await searchEntity(name);
  const { matches } = pickBestMatch(name, searchResults);

  if (matches.length === 0) {
    throw new Error(`No Wikidata match found for "${name}"`);
  }

  const { entity, entityId } = await resolveBestEntity(name, matches);

  if (!entity) {
    throw new Error(`Missing entity payload for "${name}" (${entityId ?? "unknown"})`);
  }

  return buildCelebrity(name, entity);
}

function mergeCelebrityData(current: Celebrity, refreshed: Celebrity): Celebrity {
  return {
    ...current,
    bornYear: refreshed.bornYear,
    diedYear: refreshed.diedYear,
    isAlive: refreshed.isAlive,
    wikipediaTitle: refreshed.wikipediaTitle ?? current.wikipediaTitle,
    imageUrl: refreshed.imageUrl ?? current.imageUrl,
  };
}

function celebrityChanged(left: Celebrity, right: Celebrity) {
  return (
    left.bornYear !== right.bornYear ||
    left.diedYear !== right.diedYear ||
    left.isAlive !== right.isAlive ||
    left.wikipediaTitle !== right.wikipediaTitle ||
    left.imageUrl !== right.imageUrl
  );
}

export async function refreshCelebrityDataset(existingCelebrities: Celebrity[]): Promise<RefreshCelebrityResult> {
  const refreshedCelebrities: Celebrity[] = [];
  const errors: string[] = [];
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const celebrity of existingCelebrities) {
    try {
      const refreshed = await resolveCelebrityFromWikidata(celebrity.name);
      const merged = mergeCelebrityData(celebrity, refreshed);

      if (celebrityChanged(celebrity, merged)) {
        updatedCount += 1;
      } else {
        unchangedCount += 1;
      }

      refreshedCelebrities.push(merged);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${celebrity.name}: ${message}`);
      unchangedCount += 1;
      refreshedCelebrities.push(celebrity);
    }
  }

  return {
    celebrities: refreshedCelebrities,
    updatedCount,
    unchangedCount,
    errors,
  };
}
