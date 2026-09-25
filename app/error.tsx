"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dbMissing = error.message?.includes("DATABASE_URL");
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <p className="font-mono text-[12px] tracking-[0.14em] text-rec uppercase">Error</p>
      <h1 className="mt-3 font-serif text-5xl tracking-tight">Something broke on our side.</h1>
      <p className="mt-3 text-ink-3">
        {dbMissing ? "The database isn't configured. Set DATABASE_URL and run pnpm db:migrate." : "Try again. If it keeps happening, the server logs will say why."}
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper"
      >
        Try again
      </button>
    </main>
  );
}
