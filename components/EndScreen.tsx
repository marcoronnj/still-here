import type { GameMode } from "@/types/game";

type EndScreenProps = {
  mode: GameMode;
  score: number;
  totalRounds?: number;
  clearedDeck?: boolean;
  onRestart: () => void;
};

export function EndScreen({
  mode,
  score,
  totalRounds,
  clearedDeck = false,
  onRestart,
}: EndScreenProps) {
  const isClassic = mode === "classic";
  const percentage =
    isClassic && totalRounds && totalRounds > 0 ? Math.round((score / totalRounds) * 100) : null;

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
