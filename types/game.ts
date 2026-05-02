export type GameMode = "classic" | "royal-rumble";

export function parseGameMode(value: string | null | undefined): GameMode {
  return value === "royal-rumble" ? "royal-rumble" : "classic";
}
