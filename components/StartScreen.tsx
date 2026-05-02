import Link from "next/link";

export function StartScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-line/80 bg-white/90 p-8 text-center shadow-card backdrop-blur sm:p-12">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-accent">
          Still Here?
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          Still Here?
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">
          Guess whether each famous person is alive or dead in a fast, 10-round swipe-style
          game.
        </p>
        <div className="mt-8 grid gap-3 text-left">
          <Link
            href="/game?mode=classic"
            className="rounded-[1.5rem] bg-ink px-6 py-5 text-white transition hover:scale-[1.02] hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            <span className="block text-lg font-semibold">Classic</span>
            <span className="mt-1 block text-sm text-white/75">10 questions. Final score after round 10.</span>
          </Link>
          <Link
            href="/game?mode=royal-rumble"
            className="rounded-[1.5rem] border border-line/80 bg-white px-6 py-5 text-ink transition hover:scale-[1.02] hover:border-accent/50 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            <span className="block text-lg font-semibold">Royal Rumble</span>
            <span className="mt-1 block text-sm text-muted">Keep going until your first mistake.</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
