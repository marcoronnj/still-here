"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { CelebrityCard } from "@/components/CelebrityCard";
import { EndScreen } from "@/components/EndScreen";
import { ResultPanel } from "@/components/ResultPanel";
import { ScoreBar } from "@/components/ScoreBar";
import { Celebrity, CelebrityRoundResult } from "@/types/celebrity";

const TOTAL_ROUNDS = 10;
const SWIPE_THRESHOLD = 110;
const AUTO_ADVANCE_MS = 4000;

function shuffle<T>(items: T[]) {
  const cloned = [...items];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }

  return cloned;
}

export default function GamePage() {
  const [deck, setDeck] = useState<Celebrity[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [roundResult, setRoundResult] = useState<CelebrityRoundResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCelebrity = deck[currentIndex] ?? null;
  const gameComplete = answered >= TOTAL_ROUNDS && roundResult === null;

  const resetDrag = useCallback((): void => {
    setDragX(0);
    setIsDragging(false);
    pointerIdRef.current = null;
  }, []);

  const loadGame = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setSelectedAnswer(null);
    setRoundResult(null);
    resetDrag();

    try {
      const response = await fetch("/api/celebrities", {
        cache: "no-store",
      });

      const data = (await response.json()) as Celebrity[];

      if (!response.ok || !Array.isArray(data)) {
        throw new Error("We couldn't start the game right now. Please try again.");
      }

      const uniqueDeck = Array.from(
        new Map(data.map((celebrity) => [celebrity.id, celebrity])).values(),
      );

      if (uniqueDeck.length < TOTAL_ROUNDS) {
        throw new Error("Not enough celebrities were returned to play a full round.");
      }

      setDeck(shuffle(uniqueDeck).slice(0, TOTAL_ROUNDS));
      setCurrentIndex(0);
      setScore(0);
      setStreak(0);
      setAnswered(0);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something unexpected happened while loading the game.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [resetDrag]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  const handleAnswer = useCallback(
    (guessAlive: boolean): void => {
      if (!currentCelebrity || roundResult) {
        return;
      }

      const isCorrect = currentCelebrity.isAlive === guessAlive;

      setSelectedAnswer(guessAlive);
      setRoundResult({
        celebrity: currentCelebrity,
        guessedAlive: guessAlive,
        isCorrect,
      });
      setAnswered((value) => value + 1);
      setScore((value) => value + (isCorrect ? 1 : 0));
      setStreak((value) => (isCorrect ? value + 1 : 0));
    },
    [currentCelebrity, roundResult],
  );

  const handleNext = useCallback(() => {
    advanceTimeoutRef.current = null;
    setRoundResult(null);
    setSelectedAnswer(null);
    resetDrag();
    setCurrentIndex((value) => value + 1);
  }, [resetDrag]);

  const submitSwipe = useCallback(
    (guessAlive: boolean): void => {
      if (!currentCelebrity || roundResult) {
        return;
      }

      setDragX(guessAlive ? window.innerWidth : -window.innerWidth);
      setIsDragging(false);
      handleAnswer(guessAlive);
    },
    [currentCelebrity, handleAnswer, roundResult],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (roundResult) {
        return;
      }

      pointerIdRef.current = event.pointerId;
      startXRef.current = event.clientX;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [roundResult],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (!isDragging || pointerIdRef.current !== event.pointerId || roundResult) {
        return;
      }

      setDragX(event.clientX - startXRef.current);
    },
    [isDragging, roundResult],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (pointerIdRef.current !== event.pointerId) {
        return;
      }

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}

      const currentDrag = dragX;
      resetDrag();

      if (roundResult) {
        return;
      }

      if (currentDrag >= SWIPE_THRESHOLD) {
        submitSwipe(true);
        return;
      }

      if (currentDrag <= -SWIPE_THRESHOLD) {
        submitSwipe(false);
      }
    },
    [dragX, resetDrag, roundResult, submitSwipe],
  );

  useEffect(() => {
    if (!roundResult) {
      return;
    }

    advanceTimeoutRef.current = setTimeout(() => {
      handleNext();
    }, AUTO_ADVANCE_MS);

    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
    };
  }, [handleNext, roundResult]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (roundResult || gameComplete) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        submitSwipe(true);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        submitSwipe(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [gameComplete, roundResult, submitSwipe]);

  const headerText = useMemo(() => {
    if (loading) {
      return "Loading your first batch...";
    }

    if (error) {
      return "The game couldn't load";
    }

    if (gameComplete) {
      return "Nice run";
    }

    return "Swipe the card";
  }, [error, gameComplete, loading]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mb-5 sm:mb-6">
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200/70">
            Still Here?
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {headerText}
          </h1>
        </div>
        <ScoreBar score={score} answered={answered} streak={streak} totalRounds={TOTAL_ROUNDS} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {loading ? (
          <section className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-emerald-400" />
            <p className="mt-5 text-base text-white/65">Setting up your next round...</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="w-full rounded-[2rem] border border-rose-400/20 bg-white/5 p-8 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Something went wrong</h2>
            <p className="mt-4 text-base leading-7 text-white/65">{error}</p>
            <button
              type="button"
              onClick={() => void loadGame()}
              className="mt-8 inline-flex min-h-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 px-8 text-base font-semibold text-emerald-100 transition hover:scale-[1.02] hover:bg-emerald-500/22 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Try again
            </button>
          </section>
        ) : null}

        {!loading && !error && gameComplete ? (
          <EndScreen score={score} totalRounds={TOTAL_ROUNDS} onRestart={() => void loadGame()} />
        ) : null}

        {!loading && !error && !gameComplete && currentCelebrity ? (
          <div className="w-full space-y-6 sm:space-y-7">
            <CelebrityCard
              celebrity={currentCelebrity}
              answered={Boolean(roundResult)}
              selectedAnswer={selectedAnswer}
              onAnswer={submitSwipe}
              dragX={dragX}
              isDragging={isDragging}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            />
            {!roundResult ? (
              <p className="px-2 text-center text-sm leading-6 text-white/55 sm:text-base">
                Keyboard shortcuts: <span className="font-semibold text-rose-200">Left Arrow = Gone</span>{" "}
                and <span className="font-semibold text-emerald-200">Right Arrow = Here</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && !gameComplete && !currentCelebrity ? (
          <section className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur">
            <h2 className="text-2xl font-semibold tracking-tight text-white">No round available</h2>
            <p className="mt-4 text-base leading-7 text-white/65">
              We ran out of cards unexpectedly. Restart to fetch a fresh batch.
            </p>
            <button
              type="button"
              onClick={() => void loadGame()}
              className="mt-8 inline-flex min-h-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 px-8 text-base font-semibold text-emerald-100 transition hover:scale-[1.02] hover:bg-emerald-500/22 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Restart game
            </button>
          </section>
        ) : null}
      </div>

      {roundResult ? <ResultPanel result={roundResult} /> : null}
    </main>
  );
}
