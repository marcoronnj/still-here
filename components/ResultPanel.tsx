import { CelebrityRoundResult } from "@/types/celebrity";

type ResultPanelProps = {
  result: CelebrityRoundResult;
  nextStepLabel?: string;
};

export function ResultPanel({ result, nextStepLabel = "Moving on..." }: ResultPanelProps) {
  const { celebrity, guessedAlive, isCorrect } = result;
  const answerLabel = celebrity.isAlive ? "Here" : "Gone";
  const guessedLabel = guessedAlive ? "Here" : "Gone";
  const years =
    celebrity.diedYear === null
      ? `Born ${celebrity.bornYear ?? "Unknown"}`
      : `${celebrity.bornYear ?? "Unknown"} - ${celebrity.diedYear}`;
  const resultLabel = isCorrect
    ? "Nice"
    : guessedAlive
      ? "Already cold"
      : "Not yet";

  return (
    <section
      className={`result-overlay fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center px-5 py-8 ${
        isCorrect
          ? "bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.18),transparent_34%),linear-gradient(180deg,#022c22_0%,#03120f_100%)] text-white"
          : "bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.16),transparent_34%),linear-gradient(180deg,#3f0a1d_0%,#13050b_100%)] text-white"
      }`}
    >
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 px-6 py-10 text-center shadow-[0_20px_90px_rgba(0,0,0,0.35)] backdrop-blur sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/65">
          {resultLabel}
        </p>
        <h2 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
          {celebrity.name}
        </h2>
        <p className="mt-4 text-base text-white/80 sm:text-lg">{years}</p>
        <p className="mx-auto mt-6 max-w-md text-lg leading-8 text-white/95 sm:text-2xl">
          You said <strong>{guessedLabel}</strong>. The correct answer is{" "}
          <strong>{answerLabel}</strong>.
        </p>
        <p className="mt-8 text-sm uppercase tracking-[0.24em] text-white/60">{nextStepLabel}</p>
      </div>
    </section>
  );
}
