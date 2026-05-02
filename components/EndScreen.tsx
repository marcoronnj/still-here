"use client";

import { useEffect, useMemo, useState } from "react";

import type { GameMode, RankedResultEntry, ResultEntry } from "@/types/game";

type EndScreenProps = {
  playerId: string;
  playerName: string;
  mode: GameMode;
  score: number;
  totalAnswered: number;
  totalRounds?: number;
  clearedDeck?: boolean;
  onRestart: () => void;
};

export function EndScreen({
  playerId,
  playerName,
  mode,
  score,
  totalAnswered,
  totalRounds,
  clearedDeck = false,
  onRestart,
}: EndScreenProps) {
  const isClassic = mode === "classic";
  const percentage =
    isClassic && totalRounds && totalRounds > 0 ? Math.round((score / totalRounds) * 100) : null;
  const [savedEntry, setSavedEntry] = useState<ResultEntry | null>(null);
  const [leaderboard, setLeaderboard] = useState<RankedResultEntry[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(!isClassic);
  const [isPersonalBest, setIsPersonalBest] = useState(false);
  const [currentPlayerRank, setCurrentPlayerRank] = useState<number | null>(null);

  useEffect(() => {
    if (isClassic) {
      setSavedEntry(null);
      setLeaderboard([]);
      setLeaderboardError(null);
      setLoadingLeaderboard(false);
      return;
    }

    let cancelled = false;

    const saveAndLoadLeaderboard = async () => {
      setLoadingLeaderboard(true);
      setLeaderboardError(null);

      try {
        const saveResponse = await fetch("/api/leaderboard", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerId,
            playerName,
            gameMode: mode,
            score,
            totalAnswered,
          }),
        });

        const savePayload = (await saveResponse.json()) as {
          saved?: boolean;
          isPersonalBest?: boolean;
          entry?: ResultEntry;
          currentPlayerBest?: ResultEntry | null;
          currentPlayerRank?: number | null;
          top10?: RankedResultEntry[];
          error?: string;
        };

        if (!saveResponse.ok || !savePayload.entry) {
          throw new Error(savePayload.error ?? "Unable to save your result.");
        }

        if (!cancelled) {
          setSavedEntry(savePayload.currentPlayerBest ?? savePayload.entry);
          setLeaderboard(savePayload.top10 ?? []);
          setIsPersonalBest(Boolean(savePayload.isPersonalBest));
          setCurrentPlayerRank(savePayload.currentPlayerRank ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setLeaderboardError(
            error instanceof Error ? error.message : "Leaderboard is unavailable right now.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingLeaderboard(false);
        }
      }
    };

    void saveAndLoadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [isClassic, mode, playerId, playerName, score, totalAnswered]);

  const topTen = leaderboard;
  const currentPlayerEntry = useMemo(
    () => (savedEntry ? leaderboard.find((entry) => entry.playerId === savedEntry.playerId) ?? null : null),
    [leaderboard, savedEntry],
  );
  const personalBest = savedEntry?.score ?? null;
  const showPersonalBest = !isClassic && personalBest !== null;

  return (
    <section className="rounded-[2rem] border border-line/80 bg-white p-8 text-center shadow-card sm:p-10">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-accent">
        {isClassic ? "Game Over" : "Royal Rumble Over"}
      </p>
      <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
        {isClassic ? `Final score: ${score}` : `You survived ${score} rounds`}
      </h2>
      {isClassic ? (
        <p className="mt-4 text-base leading-7 text-muted">
          You got {score} out of {totalRounds} right, for {percentage}% accuracy.
        </p>
      ) : (
        <p className="mt-4 text-base leading-7 text-muted">
          {clearedDeck
            ? "You cleared the deck."
            : "One mistake ended the run. Timeouts count as mistakes too."}
        </p>
      )}
      {!isClassic ? (
        <div className="mt-8 space-y-4 text-left">
          <div className="rounded-[1.5rem] border border-line/70 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">This Run</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[1rem] border border-line/70 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-ink">{playerName}</p>
              <p className="text-sm font-semibold text-ink">{score}</p>
            </div>
            {showPersonalBest ? (
              <p className="mt-3 text-sm text-muted">Personal best: {personalBest}</p>
            ) : null}
            {isPersonalBest ? <p className="mt-2 text-sm font-semibold text-accent">New personal best</p> : null}
          </div>

          <div className="rounded-[1.5rem] border border-line/70 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">Leaderboard</p>
                <p className="mt-1 text-sm text-muted">Top Royal Rumble runs</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted/80">
                Royal Rumble
              </p>
            </div>

            {loadingLeaderboard ? (
              <p className="mt-4 text-sm text-muted">Saving your score and loading the leaderboard...</p>
            ) : leaderboardError ? (
              <p className="mt-4 text-sm text-rose-600">{leaderboardError}</p>
            ) : (
              <div className="mt-4 space-y-2">
                {topTen.map((entry) => {
                  const isCurrentPlayer = entry.playerId === currentPlayerEntry?.playerId;

                  return (
                    <div
                      key={entry.playerId}
                      className={`flex items-center justify-between rounded-[1rem] border px-4 py-3 ${
                        isCurrentPlayer
                          ? "border-accent/60 bg-accent/10 shadow-[0_0_0_1px_rgba(14,165,233,0.15),0_10px_25px_rgba(14,165,233,0.08)]"
                          : "border-line/70 bg-white"
                      }`}
                    >
                      <p className="text-sm font-semibold text-ink">
                        {entry.rank}. {entry.playerName}
                      </p>
                      <p className="text-sm font-semibold text-ink">{entry.score}</p>
                    </div>
                  );
                })}

                {savedEntry && currentPlayerRank !== null && currentPlayerRank > 10 ? (
                  <>
                    <p className="px-2 text-center text-sm font-semibold tracking-[0.2em] text-muted">...</p>
                    <div className="flex items-center justify-between rounded-[1rem] border border-accent/60 bg-accent/10 px-4 py-3 shadow-[0_0_0_1px_rgba(14,165,233,0.15),0_10px_25px_rgba(14,165,233,0.08)]">
                      <p className="text-sm font-semibold text-ink">
                        {currentPlayerRank}. {savedEntry.playerName}
                      </p>
                      <p className="text-sm font-semibold text-ink">{savedEntry.score}</p>
                    </div>
                  </>
                ) : null}

                {!currentPlayerEntry && leaderboard.length === 0 ? (
                  <p className="rounded-[1rem] border border-line/70 bg-white px-4 py-3 text-sm text-muted">
                    No leaderboard entries yet.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onRestart}
        className="mt-8 inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-8 text-base font-semibold text-white transition hover:scale-[1.02] hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      >
        Play again
      </button>
    </section>
  );
}
