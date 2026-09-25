import type { Metadata } from "next";
import Link from "next/link";
import { getOwnerId } from "@/lib/owner";
import { listOwnerProjects } from "@/lib/queries";
import { LibraryGrid } from "@/components/LibraryGrid";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const ownerId = await getOwnerId();
  const projects = ownerId ? await listOwnerProjects(ownerId) : [];

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-5xl tracking-tight sm:text-6xl">Library</h1>
          <p className="mt-2 max-w-lg text-ink-3">
            Everything you&apos;ve started in this browser, saved to the database. Open one to keep editing it.
          </p>
        </div>
        <span className="font-mono text-[12px] text-ink-3">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-20 text-center">
          <p className="font-serif text-3xl">No projects yet</p>
          <p className="mt-2 text-ink-3">Paste a product link to start your first one.</p>
          <Link
            href="/#new"
            className="mt-6 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink-2"
          >
            New video
          </Link>
        </div>
      ) : (
        <LibraryGrid initial={projects} />
      )}
    </main>
  );
}
