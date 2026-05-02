"use client";

import { useEffect, useState } from "react";

import type { RankedResultEntry } from "@/types/game";

type LeaderboardProps = {
  onBack: () => void;
  onPlayNow: () => void;
};

export function Leaderboard({ onBack, onPlayNow }: LeaderboardProps) {
  const [results, setResults] = useState<RankedResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/leaderboard?mode=royal-rumble", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          top10?: RankedResultEntry[];
          error?: string;
        };

        if (!response.ok || !Array.isArray(payload.top10)) {
          throw new Error(payload.error ?? "Unable to load leaderboard.");
        }

        if (!cancelled) {
          setResults(payload.top10);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error ? caughtError.message : "Unable to load leaderboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="w-full max-w-xl rounded-[2rem] border border-line/80 bg-white/90 p-8 text-center shadow-card backdrop-blur sm:p-12">
      <div className="flex items-center justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-accent">Leaderboard</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Royal Rumble — Top 10
          </h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-line/80 bg-white/80 px-4 text-sm font-semibold text-ink transition hover:border-accent/40 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          Back
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-left text-sm text-muted">Loading leaderboard...</p>
      ) : error ? (
        <p className="mt-8 text-left text-sm text-rose-600">{error}</p>
      ) : results.length === 0 ? (
        <p className="mt-8 rounded-[1.25rem] border border-line/70 bg-white px-4 py-4 text-left text-sm text-muted">
          No scores yet
        </p>
      ) : (
        <div className="mt-8 space-y-2 text-left">
          {results.map((entry) => (
            <div
              key={entry.playerId}
              className="flex items-center justify-between rounded-[1.25rem] border border-line/70 bg-white px-4 py-4"
            >
              <p className="text-sm font-semibold text-ink">
                {entry.rank}. {entry.playerName}
              </p>
              <p className="text-sm font-semibold text-ink">{entry.score}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-[1.5rem] bg-ink px-6 py-6 text-left text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/65">
          Reach the Top
        </p>
        <p className="mt-3 max-w-md text-base leading-7 text-white/80">
          Jump into Royal Rumble and see how far you can climb.
        </p>
        <button
          type="button"
          onClick={onPlayNow}
          className="mt-5 inline-flex min-h-14 items-center justify-center rounded-full bg-white px-8 text-base font-semibold text-ink transition hover:scale-[1.02] hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-ink"
        >
          Play now
        </button>
      </div>
    </section>
  );
}
