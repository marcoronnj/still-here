"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CelebrityCard } from "@/components/CelebrityCard";
import { EndScreen } from "@/components/EndScreen";
import { ResultPanel } from "@/components/ResultPanel";
import { ScoreBar } from "@/components/ScoreBar";
import { Celebrity, CelebrityRoundResult } from "@/types/celebrity";
import {
  PLAYER_ID_STORAGE_KEY,
  normalizePlayerName,
  PLAYER_NAME_STORAGE_KEY,
  type GameMode,
} from "@/types/game";

const TOTAL_ROUNDS = 10;
const SWIPE_THRESHOLD = 110;
const AUTO_ADVANCE_MS = 2000;
const ROUND_DURATION_MS = 10_000;

function shuffle<T>(items: T[]) {
  const cloned = [...items];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }

  return cloned;
}

type GameScreenProps = {
  mode: GameMode;
  initialPlayerName?: string;
  initialPlayerId?: string;
};

export function GameScreen({ mode, initialPlayerName = "", initialPlayerId = "" }: GameScreenProps) {
  const router = useRouter();
  const isClassicMode = mode === "classic";
  const [playerName, setPlayerName] = useState(() => normalizePlayerName(initialPlayerName));
  const [playerNameReady, setPlayerNameReady] = useState(initialPlayerName.length > 0);
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [playerIdentityReady, setPlayerIdentityReady] = useState(Boolean(initialPlayerId));
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
  const [timeLeftMs, setTimeLeftMs] = useState(ROUND_DURATION_MS);
  const [imageReadyState, setImageReadyState] = useState<Record<string, boolean>>({});
  const [gameOverReason, setGameOverReason] = useState<"wrong-answer" | "cleared-deck" | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutHandledRef = useRef(false);
  const imagePreloadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());

  const currentCelebrity = deck[currentIndex] ?? null;
  const gameComplete = isClassicMode
    ? answered >= TOTAL_ROUNDS && roundResult === null
    : gameOverReason !== null && roundResult === null;
  const currentCardReady = currentCelebrity
    ? currentCelebrity.imageUrl === null || imageReadyState[currentCelebrity.id] === true
    : false;
  const showRoundTimer =
    !loading && !error && !gameComplete && !roundResult && Boolean(currentCelebrity) && currentCardReady;

  useEffect(() => {
    const normalizedInitialName = normalizePlayerName(initialPlayerName);

    if (normalizedInitialName) {
      setPlayerName(normalizedInitialName);
      setPlayerNameReady(true);

      try {
        window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalizedInitialName);
      } catch {}

      return;
    }

    try {
      const savedName = normalizePlayerName(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY));
      setPlayerName(savedName);
      setPlayerNameReady(true);
    } catch {
      setPlayerNameReady(true);
    }
  }, [initialPlayerName]);

  useEffect(() => {
    if (initialPlayerId) {
      setPlayerId(initialPlayerId);
      setPlayerIdentityReady(true);

      try {
        window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, initialPlayerId);
      } catch {}

      return;
    }

    try {
      const savedPlayerId = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
      const ensuredPlayerId = savedPlayerId && savedPlayerId.trim() ? savedPlayerId : crypto.randomUUID();
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, ensuredPlayerId);
      setPlayerId(ensuredPlayerId);
      setPlayerIdentityReady(true);
    } catch {
      setPlayerId(crypto.randomUUID());
      setPlayerIdentityReady(true);
    }
  }, [initialPlayerId]);

  const resetDrag = useCallback((): void => {
    setDragX(0);
    setIsDragging(false);
    pointerIdRef.current = null;
  }, []);

  const resetGameState = useCallback((): void => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    }

    imagePreloadPromisesRef.current.clear();
    timeoutHandledRef.current = false;
    resetDrag();
    setDeck([]);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setAnswered(0);
    setSelectedAnswer(null);
    setRoundResult(null);
    setLoading(false);
    setError(null);
    setTimeLeftMs(ROUND_DURATION_MS);
    setImageReadyState({});
    setGameOverReason(null);
  }, [resetDrag]);

  const handleExitGame = useCallback((): void => {
    const confirmed =
      typeof window === "undefined" ? true : window.confirm("Exit game? Progress will be lost.");

    if (!confirmed) {
      return;
    }

    resetGameState();
    router.push("/");
  }, [resetGameState, router]);

  const loadGame = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setSelectedAnswer(null);
    setRoundResult(null);
    setTimeLeftMs(ROUND_DURATION_MS);
    setImageReadyState({});
    setGameOverReason(null);
    imagePreloadPromisesRef.current.clear();
    timeoutHandledRef.current = false;
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

      if (isClassicMode && uniqueDeck.length < TOTAL_ROUNDS) {
        throw new Error("Not enough celebrities were returned to play a full round.");
      }

      const shuffledDeck = shuffle(uniqueDeck);

      setDeck(isClassicMode ? shuffledDeck.slice(0, TOTAL_ROUNDS) : shuffledDeck);
      setCurrentIndex(0);
      setScore(0);
      setStreak(0);
      setAnswered(0);
      setTimeLeftMs(ROUND_DURATION_MS);
      setImageReadyState({});
      setGameOverReason(null);
      imagePreloadPromisesRef.current.clear();
      timeoutHandledRef.current = false;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something unexpected happened while loading the game.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isClassicMode, resetDrag]);

  useEffect(() => {
    if (!playerNameReady || !playerIdentityReady || !playerName || !playerId) {
      return;
    }

    void loadGame();
  }, [loadGame, playerId, playerIdentityReady, playerName, playerNameReady]);

  useEffect(() => {
    const markReady = (celebrityId: string) => {
      setImageReadyState((current) =>
        current[celebrityId] ? current : { ...current, [celebrityId]: true },
      );
    };

    const ensureCelebrityReady = (celebrity: Celebrity | null | undefined) => {
      if (!celebrity) {
        return;
      }

      if (!celebrity.imageUrl) {
        markReady(celebrity.id);
        return;
      }

      if (imageReadyState[celebrity.id]) {
        return;
      }

      const existingPromise = imagePreloadPromisesRef.current.get(celebrity.id);

      if (existingPromise) {
        return;
      }

      const preloadPromise = new Promise<void>((resolve) => {
        try {
          const image = new window.Image();
          const finalize = () => {
            markReady(celebrity.id);
            imagePreloadPromisesRef.current.delete(celebrity.id);
            resolve();
          };

          image.onload = finalize;
          image.onerror = finalize;
          image.src = celebrity.imageUrl as string;
        } catch {
          markReady(celebrity.id);
          imagePreloadPromisesRef.current.delete(celebrity.id);
          resolve();
        }
      });

      imagePreloadPromisesRef.current.set(celebrity.id, preloadPromise);
    };

    ensureCelebrityReady(deck[currentIndex]);
    ensureCelebrityReady(deck[currentIndex + 1]);
    ensureCelebrityReady(deck[currentIndex + 2]);
  }, [currentIndex, deck, imageReadyState]);

  const handleAnswer = useCallback(
    (guessAlive: boolean): void => {
      if (!currentCelebrity || roundResult) {
        return;
      }

      const isCorrect = currentCelebrity.isAlive === guessAlive;

      if (!isCorrect && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(60);
      }

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
    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    }

    if (loading || error || gameComplete || roundResult || !currentCelebrity || !currentCardReady) {
      setTimeLeftMs(ROUND_DURATION_MS);
      timeoutHandledRef.current = false;
      return;
    }

    timeoutHandledRef.current = false;
    const roundEndsAt = Date.now() + ROUND_DURATION_MS;
    setTimeLeftMs(ROUND_DURATION_MS);

    roundTimerRef.current = setInterval(() => {
      const nextTimeLeft = Math.max(roundEndsAt - Date.now(), 0);
      setTimeLeftMs(nextTimeLeft);

      if (nextTimeLeft > 0 || timeoutHandledRef.current) {
        return;
      }

      timeoutHandledRef.current = true;

      if (roundTimerRef.current) {
        clearInterval(roundTimerRef.current);
        roundTimerRef.current = null;
      }

      handleAnswer(!currentCelebrity.isAlive);
    }, 100);

    return () => {
      if (roundTimerRef.current) {
        clearInterval(roundTimerRef.current);
        roundTimerRef.current = null;
      }
    };
  }, [currentCardReady, currentCelebrity, error, gameComplete, handleAnswer, loading, roundResult]);

  useEffect(() => {
    if (!roundResult) {
      return;
    }

    advanceTimeoutRef.current = setTimeout(() => {
      if (!isClassicMode && !roundResult.isCorrect) {
        setRoundResult(null);
        setSelectedAnswer(null);
        resetDrag();
        setGameOverReason("wrong-answer");
        return;
      }

      if (!isClassicMode && currentIndex + 1 >= deck.length) {
        setRoundResult(null);
        setSelectedAnswer(null);
        resetDrag();
        setGameOverReason("cleared-deck");
        return;
      }

      handleNext();
    }, AUTO_ADVANCE_MS);

    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
    };
  }, [currentIndex, deck.length, handleNext, isClassicMode, resetDrag, roundResult]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }

      if (roundTimerRef.current) {
        clearInterval(roundTimerRef.current);
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

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden px-4 py-3 text-white sm:px-6 sm:py-4">
      <div className="mb-3 flex items-center justify-start">
        <button
          type="button"
          onClick={handleExitGame}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white/80 shadow-[0_8px_24px_rgba(2,6,23,0.2)] backdrop-blur transition hover:bg-white/16 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/25"
          aria-label="Exit game"
        >
          ←
        </button>
      </div>
      {!playerNameReady || !playerIdentityReady ? (
        <div className="flex flex-1 items-center justify-center">
          <section className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-emerald-400" />
            <p className="mt-5 text-base text-white/65">Loading player profile...</p>
          </section>
        </div>
      ) : !playerName ? (
        <div className="flex flex-1 items-center justify-center">
          <section className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-200/80">Still Here?</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">Name required</h2>
            <p className="mt-4 text-base leading-7 text-white/65">
              Enter your player name on the start screen before starting a run.
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex min-h-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 px-8 text-base font-semibold text-emerald-100 transition hover:scale-[1.02] hover:bg-emerald-500/22 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Back to start
            </Link>
          </section>
        </div>
      ) : (
        <>
      <div className="mb-3">
        <ScoreBar
          mode={mode}
          score={score}
          answered={answered}
          streak={streak}
          totalRounds={isClassicMode ? TOTAL_ROUNDS : undefined}
          roundTimeLeftMs={timeLeftMs}
          roundDurationMs={ROUND_DURATION_MS}
          showTimer={showRoundTimer}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden">
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
          <EndScreen
            playerId={playerId}
            playerName={playerName}
            mode={mode}
            score={score}
            totalAnswered={answered}
            totalRounds={isClassicMode ? TOTAL_ROUNDS : undefined}
            clearedDeck={gameOverReason === "cleared-deck"}
            onRestart={() => void loadGame()}
          />
        ) : null}

        {!loading && !error && !gameComplete && currentCelebrity && currentCardReady ? (
          <div className="flex w-full flex-1 items-center">
            <CelebrityCard
              key={currentCelebrity.id}
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
          </div>
        ) : null}

        {!loading && !error && !gameComplete && currentCelebrity && !currentCardReady ? (
          <section className="flex w-full flex-1 items-center">
            <div className="mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0f172acc] shadow-[0_20px_80px_rgba(2,6,23,0.55),0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur">
              <div className="relative aspect-[4/5] max-h-[40dvh] w-full overflow-hidden bg-[#131c31] sm:max-h-[44dvh]">
                <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_34%),linear-gradient(180deg,rgba(30,41,59,0.95)_0%,rgba(15,23,42,1)_100%)]" />
                <div className="absolute inset-0 animate-pulse bg-white/[0.03]" />
              </div>
              <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
                <div className="flex items-end justify-center gap-6 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
                  <div className="h-20 w-20 rounded-full border border-white/10 bg-white/5 sm:h-[5.1rem] sm:w-[5.1rem]" />
                  <div className="h-20 w-20 rounded-full border border-white/10 bg-white/5 sm:h-[5.1rem] sm:w-[5.1rem]" />
                </div>
                <p className="text-center text-[0.72rem] font-medium text-white/35">
                  Preparing next card...
                </p>
              </div>
            </div>
          </section>
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

      {roundResult ? (
        <ResultPanel
          result={roundResult}
          nextStepLabel={
            !isClassicMode && !roundResult.isCorrect
              ? "Run ending..."
              : !isClassicMode && currentIndex + 1 >= deck.length
                ? "Deck cleared..."
                : "Moving on..."
          }
        />
      ) : null}
        </>
      )}
    </main>
  );
}
