export type GameMode = "classic" | "royal-rumble";

export type ResultEntry = {
  id: string;
  playerName: string;
  score: number;
  totalAnswered: number;
  createdAt: string;
};

export type RankedResultEntry = ResultEntry & {
  rank: number;
};

export const PLAYER_NAME_MAX_LENGTH = 20;
export const PLAYER_NAME_STORAGE_KEY = "still-here-player-name";

export function parseGameMode(value: string | null | undefined): GameMode {
  return value === "royal-rumble" ? "royal-rumble" : "classic";
}

export function isGameMode(value: unknown): value is GameMode {
  return value === "classic" || value === "royal-rumble";
}

export function normalizePlayerName(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, PLAYER_NAME_MAX_LENGTH);
}
