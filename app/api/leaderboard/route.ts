import { NextRequest, NextResponse } from "next/server";

import { getLeaderboardSnapshot, saveLeaderboardEntry } from "@/lib/leaderboard";
import {
  isGameMode,
  normalizeNameForLookup,
  normalizePlayerName,
  parseGameMode,
  PLAYER_NAME_MAX_LENGTH,
  type GameMode,
  type ResultEntry,
} from "@/types/game";

function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseModeFromQuery(request: NextRequest): GameMode {
  return parseGameMode(request.nextUrl.searchParams.get("mode"));
}

function isValidPlayerId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 100;
}

export async function GET(request: NextRequest) {
  try {
    const mode = parseModeFromQuery(request);
    const playerId = request.nextUrl.searchParams.get("playerId");
    const snapshot = await getLeaderboardSnapshot(playerId);

    return NextResponse.json({
      mode: "royal-rumble",
      requestedMode: mode,
      ...snapshot,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load leaderboard right now.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<{
      playerId: string;
      playerName: string;
      gameMode: GameMode;
      score: number;
      totalAnswered: number;
    }>;

    if (!isValidPlayerId(body.playerId)) {
      return NextResponse.json({ error: "playerId is required." }, { status: 400 });
    }

    const playerId = body.playerId.trim();
    const playerName = normalizePlayerName(body.playerName);
    const normalizedName = normalizeNameForLookup(body.playerName);
    if (!isGameMode(body.gameMode)) {
      return NextResponse.json({ error: "gameMode must be classic or royal-rumble." }, { status: 400 });
    }

    const gameMode = body.gameMode;
    const score = body.score;
    const totalAnswered = body.totalAnswered;

    if (!playerName) {
      return NextResponse.json({ error: "Player name is required." }, { status: 400 });
    }

    if (playerName.length > PLAYER_NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Player name must be at most ${PLAYER_NAME_MAX_LENGTH} characters.` },
        { status: 400 },
      );
    }

    if (!isValidNonNegativeInteger(score) || !isValidNonNegativeInteger(totalAnswered)) {
      return NextResponse.json({ error: "Score and totalAnswered must be non-negative integers." }, { status: 400 });
    }

    if (totalAnswered < score) {
      return NextResponse.json({ error: "totalAnswered cannot be smaller than score." }, { status: 400 });
    }

    if (gameMode !== "royal-rumble") {
      const snapshot = await getLeaderboardSnapshot(playerId);

      return NextResponse.json({
        saved: false,
        isPersonalBest: false,
        ...snapshot,
      });
    }

    const now = new Date().toISOString();
    const result: ResultEntry = {
      playerId,
      playerName,
      normalizedName,
      score,
      totalAnswered,
      createdAt: now,
      updatedAt: now,
    };

    const savedEntry = await saveLeaderboardEntry(result);
    const snapshot = await getLeaderboardSnapshot(playerId);

    return NextResponse.json({
      saved: savedEntry.saved,
      isPersonalBest: savedEntry.isPersonalBest,
      entry: savedEntry.entry,
      currentPlayerBest: snapshot.currentPlayerBest,
      currentPlayerRank: snapshot.currentPlayerRank,
      top10: snapshot.top10,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save leaderboard entry.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
