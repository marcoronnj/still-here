"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Leaderboard } from "@/components/Leaderboard";
import {
  PLAYER_ID_STORAGE_KEY,
  normalizePlayerName,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
  type GameMode,
} from "@/types/game";

export function StartScreen() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    try {
      const savedName = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
      const savedPlayerId = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);

      if (savedName) {
        setPlayerName(normalizePlayerName(savedName));
      }

      if (!savedPlayerId) {
        window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, crypto.randomUUID());
      }
    } catch {}
  }, []);

  const trimmedName = normalizePlayerName(playerName);
  const showNameError = nameTouched && !trimmedName;

  const handleStart = (mode: GameMode) => {
    const normalizedName = normalizePlayerName(playerName);
    setNameTouched(true);

    if (!normalizedName) {
      return;
    }

    try {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalizedName);
      const currentPlayerId =
        window.localStorage.getItem(PLAYER_ID_STORAGE_KEY) ?? crypto.randomUUID();
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, currentPlayerId);

      router.push(
        `/game?mode=${mode}&playerName=${encodeURIComponent(normalizedName)}&playerId=${encodeURIComponent(currentPlayerId)}`,
      );
      return;
    } catch {}

    router.push(`/game?mode=${mode}&playerName=${encodeURIComponent(normalizedName)}`);
  };

  if (showLeaderboard) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-10">
        <Leaderboard
          onBack={() => setShowLeaderboard(false)}
          onPlayNow={() => handleStart("royal-rumble")}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-line/80 bg-white/90 p-8 text-center shadow-card backdrop-blur sm:p-12">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-accent">
          Still Here?
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          Still Here?
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">
          Guess whether each famous person is alive or dead in a fast, 10-round swipe-style
          game.
        </p>

        <div className="mx-auto mt-8 max-w-md text-left">
          <label htmlFor="player-name" className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            Player Name
          </label>
          <input
            id="player-name"
            type="text"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value.slice(0, PLAYER_NAME_MAX_LENGTH))}
            onBlur={() => setNameTouched(true)}
            placeholder="Your name"
            maxLength={PLAYER_NAME_MAX_LENGTH}
            className="mt-3 w-full rounded-[1.2rem] border border-line/80 bg-white px-4 py-3 text-base text-ink shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <p className={showNameError ? "text-rose-600" : "text-muted"}>
              {showNameError ? "Please enter your name before starting." : "Required before you play."}
            </p>
            <p className="text-muted">
              {trimmedName.length}/{PLAYER_NAME_MAX_LENGTH}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 text-left">
          <button
            type="button"
            onClick={() => handleStart("classic")}
            className="rounded-[1.5rem] bg-ink px-6 py-5 text-white transition hover:scale-[1.02] hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            <span className="block text-lg font-semibold">Classic</span>
            <span className="mt-1 block text-sm text-white/75">10 questions. Final score after round 10.</span>
          </button>
          <button
            type="button"
            onClick={() => handleStart("royal-rumble")}
            className="rounded-[1.5rem] border border-line/80 bg-white px-6 py-5 text-ink transition hover:scale-[1.02] hover:border-accent/50 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            <span className="block text-lg font-semibold">Royal Rumble</span>
            <span className="mt-1 block text-sm text-muted">Keep going until your first mistake.</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowLeaderboard(true)}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full border border-line/80 bg-white/70 px-6 text-sm font-semibold text-ink transition hover:border-accent/50 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          View leaderboard
        </button>
      </section>
    </main>
  );
}
