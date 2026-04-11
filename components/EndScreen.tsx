type EndScreenProps = {
  score: number;
  totalRounds: number;
  onRestart: () => void;
};

export function EndScreen({ score, totalRounds, onRestart }: EndScreenProps) {
  const percentage = Math.round((score / totalRounds) * 100);

  return (
    <section className="rounded-[2rem] border border-line/80 bg-white p-8 text-center shadow-card sm:p-10">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-accent">Game Over</p>
      <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink">Final score: {score}</h2>
      <p className="mt-4 text-base leading-7 text-muted">
        You got {score} out of {totalRounds} right, for {percentage}% accuracy.
      </p>
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
