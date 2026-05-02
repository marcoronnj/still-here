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
  type RankedResultEntry,
} from "@/types/game";

export function StartScreen() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [topScore, setTopScore] = useState<number | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    const loadTopScore = async () => {
      try {
        const response = await fetch("/api/leaderboard?mode=royal-rumble", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          top10?: RankedResultEntry[];
        };

        if (!response.ok || !Array.isArray(payload.top10)) {
          return;
        }

        if (!cancelled) {
          setTopScore(payload.top10[0]?.score ?? null);
        }
      } catch {
        if (!cancelled) {
          setTopScore(null);
        }
      }
    };

    void loadTopScore();

    return () => {
      cancelled = true;
    };
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
          Guess whether each famous person is alive or dead, then chase the Royal Rumble
          leaderboard.
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

        <div className="mt-8 grid gap-4 text-left">
          <section className="rounded-[1.5rem] bg-ink px-6 py-6 text-white shadow-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-2xl font-semibold tracking-tight">ROYAL RUMBLE 🔥</p>
                <p className="mt-2 text-base font-medium text-white/85">Play until you lose</p>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                  Score saved • Leaderboard
                </p>
              </div>
              <div className="rounded-[1rem] border border-white/15 bg-white/10 px-4 py-3 sm:text-right">
                <p className="text-sm font-semibold text-white/70">Top score: {topScore ?? "—"}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/75">Think you can beat it?</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleStart("royal-rumble")}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-3 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-white hover:text-ink focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-ink sm:px-6 sm:text-base"
              >
                PLAY NOW
              </button>
              <button
                type="button"
                onClick={() => setShowLeaderboard(true)}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/35 bg-transparent px-3 text-center text-sm font-semibold text-white transition hover:scale-[1.02] hover:border-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-ink sm:px-6 sm:text-base"
              >
                View leaderboard
              </button>
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-line/80 bg-white/70 px-5 py-5 text-ink">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold tracking-tight">CLASSIC</p>
                <p className="mt-1 text-sm font-medium text-muted">10 rounds</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Practice mode • No score saved
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStart("classic")}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-line/80 bg-white px-5 text-sm font-semibold text-ink transition hover:border-accent/50 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                Play Classic
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
