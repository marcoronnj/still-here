import Image from "next/image";
import type { PointerEvent as ReactPointerEvent } from "react";

import { Celebrity } from "@/types/celebrity";

type CelebrityCardProps = {
  celebrity: Celebrity;
  answered: boolean;
  selectedAnswer: boolean | null;
  onAnswer: (guessAlive: boolean) => void;
  dragX: number;
  isDragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

function buttonClasses(kind: "alive" | "dead", answered: boolean, selectedAnswer: boolean | null) {
  const base =
    "flex h-20 w-20 items-center justify-center rounded-full border transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-[0.96]";

  if (!answered) {
    return kind === "alive"
      ? `${base} border-emerald-400/50 bg-emerald-500/15 text-emerald-100 shadow-[0_0_24px_rgba(74,222,128,0.24)] hover:scale-[1.03] hover:bg-emerald-500/22 focus:ring-emerald-400`
      : `${base} border-rose-400/45 bg-rose-500/12 text-rose-100 shadow-[0_0_24px_rgba(244,114,182,0.18)] hover:scale-[1.03] hover:bg-rose-500/18 focus:ring-rose-400`;
  }

  const selected =
    (kind === "alive" && selectedAnswer === true) || (kind === "dead" && selectedAnswer === false);

  if (selected) {
    return kind === "alive"
      ? `${base} border-emerald-300 bg-emerald-500 text-white shadow-[0_0_30px_rgba(74,222,128,0.3)] opacity-100`
      : `${base} border-rose-300 bg-rose-500 text-white shadow-[0_0_30px_rgba(244,114,182,0.3)] opacity-100`;
  }

  return `${base} cursor-not-allowed border-white/10 bg-white/5 text-white/30 opacity-60`;
}

export function CelebrityCard({
  celebrity,
  answered,
  selectedAnswer,
  onAnswer,
  dragX,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CelebrityCardProps) {
  const rotation = dragX / 24;
  const dragStrength = Math.min(Math.abs(dragX) / 140, 1);
  const showLeftCue = dragX < -10 || isDragging;
  const showRightCue = dragX > 10 || isDragging;
  const leftOpacity = dragX < 0 ? Math.max(dragStrength, 0.18) : isDragging ? 0.12 : 0;
  const rightOpacity = dragX > 0 ? Math.max(dragStrength, 0.18) : isDragging ? 0.12 : 0;
  const tintColor =
    dragX > 0
      ? `rgba(74, 222, 128, ${dragStrength * 0.18})`
      : dragX < 0
        ? `rgba(244, 114, 182, ${dragStrength * 0.16})`
        : "transparent";

  return (
    <article
      className="card-enter mx-auto flex w-full max-w-xl touch-none select-none flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f172acc] shadow-[0_20px_80px_rgba(2,6,23,0.55),0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur"
      style={{
        transform: `translate3d(${dragX}px, 0, 0) rotate(${rotation}deg)`,
        transition: isDragging ? "none" : "transform 220ms ease",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="relative aspect-[4/5] max-h-[44dvh] w-full overflow-hidden bg-[#131c31] sm:max-h-[48dvh]">
        {celebrity.imageUrl ? (
          <Image
            src={celebrity.imageUrl}
            alt={celebrity.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 420px"
            priority
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_36%),radial-gradient(circle_at_bottom,rgba(74,222,128,0.12),transparent_30%),linear-gradient(180deg,#1e293b_0%,#0f172a_100%)]" />
        )}

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 transition duration-150" style={{ backgroundColor: tintColor }} />
          <div
            className={`absolute left-4 top-4 rounded-full border border-rose-300/35 bg-rose-500/12 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-rose-200 transition duration-150 ${
              showLeftCue ? "opacity-100" : "opacity-0"
            }`}
            style={{ opacity: leftOpacity }}
          >
            Gone
          </div>
          <div
            className={`absolute right-4 top-4 rounded-full border border-emerald-300/40 bg-emerald-500/12 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200 transition duration-150 ${
              showRightCue ? "opacity-100" : "opacity-0"
            }`}
            style={{ opacity: rightOpacity }}
          >
            Here
          </div>

          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#020617]/90 via-[#020617]/35 to-transparent" />
        </div>
      </div>

      <div className="space-y-5 p-5 sm:space-y-6 sm:p-7">
        <div className="space-y-3 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-white/45">
            Famous Person
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-[2.6rem]">
            {celebrity.name}
          </h2>
        </div>

        <div className="flex items-end justify-center gap-8 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => onAnswer(false)}
              disabled={answered}
              aria-label="Gone"
              className={buttonClasses("dead", answered, selectedAnswer)}
            >
              <span className="text-3xl leading-none">X</span>
            </button>
            <span className="text-sm font-semibold tracking-[0.22em] text-rose-200 uppercase">
              Gone
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => onAnswer(true)}
              disabled={answered}
              aria-label="Here"
              className={buttonClasses("alive", answered, selectedAnswer)}
            >
              <span className="text-3xl leading-none">✓</span>
            </button>
            <span className="text-sm font-semibold tracking-[0.22em] text-emerald-200 uppercase">
              Here
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
