import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCelebrityFromWikidata } from "../lib/celebrityRefresh";
import type { Celebrity } from "../types/celebrity";

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

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

async function main() {
  const uniqueNames = Array.from(
    new Map(RAW_NAMES.map((name) => [normalizeName(name), name])).values(),
  );
  const celebrities: Celebrity[] = [];
  const unresolvedNames: string[] = [];

  console.log(`Resolving ${uniqueNames.length} Italian celebrities from Wikidata...`);

  for (const name of uniqueNames) {
    try {
      const celebrity = await resolveCelebrityFromWikidata(name);
      celebrities.push(celebrity);
      console.log(`Resolved ${name} -> ${celebrity.wikipediaTitle ?? celebrity.name}`);
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
