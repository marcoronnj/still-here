import { GameScreen } from "@/components/GameScreen";
import { normalizePlayerName, parseGameMode } from "@/types/game";

type GamePageProps = {
  searchParams?: Promise<{
    mode?: string;
    playerName?: string;
  }>;
};

export default async function GamePage({ searchParams }: GamePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const mode = parseGameMode(resolvedSearchParams?.mode);
  const playerName = normalizePlayerName(resolvedSearchParams?.playerName);

  return <GameScreen mode={mode} initialPlayerName={playerName} />;
}
