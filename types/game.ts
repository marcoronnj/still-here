export type GameMode = "classic" | "royal-rumble";

export type ResultEntry = {
  playerId: string;
  playerName: string;
  normalizedName: string;
  score: number;
  totalAnswered: number;
  createdAt: string;
  updatedAt: string;
};

export type RankedResultEntry = ResultEntry & {
  rank: number;
};

export type LeaderboardSnapshot = {
  top10: RankedResultEntry[];
  currentPlayerBest: ResultEntry | null;
  currentPlayerRank: number | null;
};

export const PLAYER_NAME_MAX_LENGTH = 20;
export const PLAYER_NAME_STORAGE_KEY = "still-here-player-name";
export const PLAYER_ID_STORAGE_KEY = "still-here-player-id";

export function parseGameMode(value: string | null | undefined): GameMode {
  return value === "royal-rumble" ? "royal-rumble" : "classic";
}

export function isGameMode(value: unknown): value is GameMode {
  return value === "classic" || value === "royal-rumble";
}

export function normalizePlayerName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, PLAYER_NAME_MAX_LENGTH);
}

export function normalizeNameForLookup(value: string | null | undefined): string {
  return normalizePlayerName(value).toLocaleLowerCase();
}
