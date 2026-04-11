import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Celebrity = {
  id: string;
  name: string;
  bornYear: number | null;
  diedYear: number | null;
  isAlive: boolean;
  wikipediaTitle: string | null;
  imageUrl: string | null;
};

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

const RAW_NAMES = [
  "Adriano Celentano",
  "Afrika Bambaataa",
  "Alberto Castagna",
  "Alberto Sordi",
  "Alberto Tomba",
  "Alessandro Baricco",
  "Alessandro Borghi",
  "Alice Kessler",
  "Angela Lansbury",
  "Anjelica Huston",
  "Annie Lennox",
  "Barbara De Rossi",
  "Billy Idol",
  "Bridget Fonda",
  "Brigitte Bardot",
  "Bruno Arena",
  "Bud Spencer",
  "Carlo Mazzacurati",
  "Catherine Anne O’Hara",
  "Chuck Norris",
  "Claudia Cardinale",
  "Clint Eastwood",
  "Corrado",
  "Corrado Augias",
  "David Hasselhoff",
  "David Sassoli",
  "Dennis Rodman",
  "Dick Van Dyke",
  "Diego Abatantuono",
  "Diego Della Valle",
  "Dolores O’Riordan",
  "Edwige Fenech",
  "Eleonora Giorgi",
  "Ennio Fantastichini",
  "Ennio Morricone",
  "Enzo Salvi",
  "Ezio Bosso",
  "Felix Baumgartner",
  "Fabrizio Frizzi",
  "Franco Battiato",
  "Franco Frattini",
  "Gabriel Garko",
  "Gary Coleman",
  "Gene Hackman",
  "George Foreman",
  "George W Bush",
  "Gianluca Vialli",
  "Gigi Proietti",
  "Gina Lollobrigida",
  "Giorgio Forattini",
  "Giulio Scarpati",
  "Giobbe Covatta",
  "Gianni Morandi",
  "Giancarlo Giannini",
  "Hulk Hogan",
  "Ivano Fossati",
  "Ivana Trump",
  "Irene Cara",
  "Jack Nicholson",
  "James Van der Beek",
  "Jean-Claude Van Damme",
  "Jean-Luc Godard",
  "Jeff Beck",
  "J. K. Rowling",
  "Kim Rossi Stuart",
  "Kobe Bryant",
  "Lando Buzzanca",
  "Liam Payne",
  "Lucia Bosè",
  "Luca Zingaretti",
  "Magic Johnson",
  "Maggie Smith",
  "Mariangela Melato",
  "Marco Tardelli",
  "Massimo D’Alema",
  "Massimo Gramellini",
  "Maurizio Costanzo",
  "Mel Brooks",
  "Michael Madsen",
  "Michele Placido",
  "Milly Carlucci",
  "Milva",
  "Mina",
  "Monica Vitti",
  "Nancy Brilli",
  "Neil Peart",
  "Niccolò Ammaniti",
  "Nicola Pietrangeli",
  "Nino Manfredi",
  "Ornella Muti",
  "Ornella Vanoni",
  "Ozzy Osbourne",
  "Paolo Hendel",
  "Paolo Rossi",
  "Paolo Taviani",
  "Paolo Villaggio",
  "Patrizia De Blanck y Menocal",
  "Pelé",
  "Peter Fonda",
  "Phil Collins",
  "Pierfrancesco Favino",
  "Piero Angela",
  "Pino Daniele",
  "Pippo Baudo",
  "Raquel Welch",
  "Raffaella Carrà",
  "Raimondo Vianello",
  "Remo Girone",
  "Renato Pozzetto",
  "Renzo Arbore",
  "Rick Moranis",
  "Roberto Cavalli",
  "Roberto Maroni",
  "Roberto Vecchioni",
  "Robert Selden Duvall",
  "Romano Prodi",
  "Rocco Commisso",
  "Sandra Milo",
  "Sidney Poitier",
  "Sinisa Mihajlovic",
  "Sophie Kinsella",
  "Sophia Loren",
  "Steven Seagal",
  "Stefano Benni",
  "Terence Hill",
  "Terry Jones",
  "Tina Turner",
  "Tiziano Crudeli",
  "Ugo Tognazzi",
  "Umberto Eco",
  "Valentino Garavani",
  "Vittorio Emanuele di Savoia",
  "Vittorio Sgarbi",
  "Walter Chiari",
  "Walter Veltroni",
  "Yao Ming",
  "Zach Efron",
];

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slugify(value: string) {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractYear(claims: WikidataTimeClaim[] | undefined) {
  const time = claims?.[0]?.mainsnak?.datavalue?.value?.time;

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

  const normalized = normalizeName(description);
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
        "User-Agent": "Still-Here-Generator/1.0",
      },
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
    search: normalizeName(name),
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

  const normalizedTarget = normalizeName(name);
  const scoredResults = results
    .map((result) => {
      const candidates = [
        result.label,
        result.display?.label?.value,
        ...(result.aliases ?? []),
      ].filter(Boolean) as string[];
      const hasExact = candidates.some(
        (candidate) => normalizeName(candidate) === normalizedTarget,
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
    const candidates = [
      `No search results for "${name}"`,
    ];

    return { matches: [] as WikidataSearchResult[], warning: candidates[0] };
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
    id: slugify(name),
    name,
    bornYear,
    diedYear,
    isAlive: diedYear === null,
    wikipediaTitle,
    imageUrl,
  };
}

function toTsString(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function renderFile(celebrities: Celebrity[]) {
  const body = celebrities
    .map((celebrity) => {
      const fields = [
        `    id: ${toTsString(celebrity.id)},`,
        `    name: ${toTsString(celebrity.name)},`,
        `    bornYear: ${celebrity.bornYear ?? "null"},`,
        `    diedYear: ${celebrity.diedYear ?? "null"},`,
        `    isAlive: ${celebrity.isAlive ? "true" : "false"},`,
        `    wikipediaTitle: ${celebrity.wikipediaTitle ? toTsString(celebrity.wikipediaTitle) : "null"},`,
        `    imageUrl: ${celebrity.imageUrl ? toTsString(celebrity.imageUrl) : "null"}`,
      ];

      return `  {\n${fields.join("\n")}\n  }`;
    })
    .join(",\n");

  return `import type { Celebrity } from '@/types/celebrity';\n\nexport const italianCelebrities: Celebrity[] = [\n${body}\n];\n`;
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

async function main() {
  const uniqueNames = Array.from(
    new Map(RAW_NAMES.map((name) => [normalizeName(name), name])).values(),
  );
  const celebrities: Celebrity[] = [];
  const unresolvedNames: string[] = [];

  console.log(`Resolving ${uniqueNames.length} Italian celebrities from Wikidata...`);

  for (const name of uniqueNames) {
    try {
      const overrideId = ENTITY_OVERRIDES[name];

      if (overrideId) {
        const entity = await fetchEntity(overrideId);

        if (!entity) {
          console.warn(`Warning: Override entity payload missing for "${name}" (${overrideId})`);
          unresolvedNames.push(name);
          continue;
        }

        celebrities.push(buildCelebrity(name, entity));
        console.log(`Resolved ${name} -> ${overrideId} (override)`);
        continue;
      }

      const searchResults = await searchEntity(name);
      const { matches, warning } = pickBestMatch(name, searchResults);

      if (warning) {
        console.warn(`Warning: ${warning}`);
      }

      if (matches.length === 0) {
        unresolvedNames.push(name);
        continue;
      }

      const { entity, entityId, warning: entityWarning } = await resolveBestEntity(name, matches);

      if (entityWarning) {
        console.warn(`Warning: ${name}: ${entityWarning}`);
      }

      if (!entity) {
        console.warn(`Warning: Missing entity payload for "${name}" (${entityId ?? "unknown"})`);
        unresolvedNames.push(name);
        continue;
      }

      celebrities.push(buildCelebrity(name, entity));
      console.log(`Resolved ${name} -> ${entityId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to resolve "${name}": ${message}`);
      unresolvedNames.push(name);
    }
  }

  const sortedCelebrities = celebrities.sort((a, b) => a.name.localeCompare(b.name, "it"));
  const output = renderFile(sortedCelebrities);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, "..");
  const outputPath = path.join(projectRoot, "lib", "italianCelebrities.ts");

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");

  console.log(`Wrote ${sortedCelebrities.length} celebrities to ${outputPath}`);

  if (unresolvedNames.length > 0) {
    console.log(`Unresolved names (${unresolvedNames.length}):`);
    for (const name of unresolvedNames) {
      console.log(`- ${name}`);
    }
  } else {
    console.log("Unresolved names: none");
  }
}

void main();
