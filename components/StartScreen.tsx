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
        <Link
          href="/game"
          className="mt-8 inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-8 text-base font-semibold text-white transition hover:scale-[1.02] hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          Play
        </Link>
      </section>
    </main>
  );
}
