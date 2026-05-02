import { GameScreen } from "@/components/GameScreen";
import { parseGameMode } from "@/types/game";

type GamePageProps = {
  searchParams?: Promise<{
    mode?: string;
  }>;
};

export default async function GamePage({ searchParams }: GamePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const mode = parseGameMode(resolvedSearchParams?.mode);

  return <GameScreen mode={mode} />;
}
