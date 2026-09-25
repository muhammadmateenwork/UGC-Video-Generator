import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <p className="font-mono text-[12px] tracking-[0.14em] text-ink-3 uppercase">404</p>
      <h1 className="mt-3 font-serif text-5xl tracking-tight">This cut doesn&apos;t exist.</h1>
      <p className="mt-3 text-ink-3">It may have been deleted, or the link is wrong.</p>
      <Link href="/" className="mt-8 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper">
        Back to the studio
      </Link>
    </main>
  );
}
