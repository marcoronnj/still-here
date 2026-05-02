import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getRankedLeaderboard, saveLeaderboardEntry } from "@/lib/leaderboard";
import {
  isGameMode,
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

export async function GET(request: NextRequest) {
  try {
    const mode = parseModeFromQuery(request);
    const results = await getRankedLeaderboard();

    return NextResponse.json({
      mode: "royal-rumble",
      requestedMode: mode,
      results,
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
      playerName: string;
      gameMode: GameMode;
      score: number;
      totalAnswered: number;
    }>;

    const playerName = normalizePlayerName(body.playerName);
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
      return NextResponse.json({
        ignored: true,
      });
    }

    const result: ResultEntry = {
      id: randomUUID(),
      playerName,
      score,
      totalAnswered,
      createdAt: new Date().toISOString(),
    };

    const savedEntry = await saveLeaderboardEntry(result);

    return NextResponse.json({
      ignored: false,
      entry: savedEntry.entry,
      updated: savedEntry.updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save leaderboard entry.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
