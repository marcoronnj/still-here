type ScoreBarProps = {
  score: number;
  answered: number;
  streak: number;
  totalRounds: number;
};

export function ScoreBar({ score, answered, streak, totalRounds }: ScoreBarProps) {
  const progress = Math.min((answered / totalRounds) * 100, 100);
  const stats = [
    { label: "Score", value: score },
    { label: "Streak", value: streak },
    { label: "Round", value: `${Math.min(answered + 1, totalRounds)}/${totalRounds}` },
  ];

  return (
    <div className="w-full space-y-3">
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
            className="rounded-[1.35rem] border border-white/10 bg-white/5 px-3 py-3 text-center shadow-[0_0_24px_rgba(15,23,42,0.28)] backdrop-blur"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/45">
              {stat.label}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
