import type { GameMode } from "@/types/game";

type ScoreBarProps = {
  mode: GameMode;
  score: number;
  answered: number;
  streak: number;
  totalRounds?: number;
  roundTimeLeftMs: number;
  roundDurationMs: number;
  showTimer: boolean;
};

export function ScoreBar({
  mode,
  score,
  answered,
  streak,
  totalRounds,
  roundTimeLeftMs,
  roundDurationMs,
  showTimer,
}: ScoreBarProps) {
  const isClassic = mode === "classic";
  const progress =
    isClassic && totalRounds ? Math.min((answered / totalRounds) * 100, 100) : Math.min(streak * 12, 100);
  const roundProgress = Math.max((roundTimeLeftMs / roundDurationMs) * 100, 0);
  const secondsLeft = Math.max(Math.ceil(roundTimeLeftMs / 1000), 0);
  const stats = [
    { label: "Score", value: score },
    { label: "Streak", value: streak },
    isClassic
      ? { label: "Round", value: `${Math.min(answered + 1, totalRounds ?? 0)}/${totalRounds}` }
      : { label: "Mode", value: "Rumble" },
  ];

  return (
    <div className="w-full space-y-2.5">
      {showTimer ? (
        <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-3 py-2.5 shadow-[0_0_24px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/45">
              Round Timer
            </p>
            <p className="text-xs font-semibold text-white/65">{secondsLeft}s left</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 transition-[width] duration-100 ease-linear"
              style={{ width: `${roundProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.55)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[1.15rem] border border-white/10 bg-white/5 px-3 py-2.5 text-center shadow-[0_0_24px_rgba(15,23,42,0.28)] backdrop-blur"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/45">
              {stat.label}
            </p>
            <p className="mt-1 text-base font-semibold tracking-tight text-white sm:text-lg">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
