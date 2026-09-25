import Link from "next/link";
import { MarkIcon, PlusIcon } from "./icons";
import { NavLink } from "./NavLink";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Cutroom home">
          <MarkIcon className="h-6 w-6 text-ink" />
          <span className="font-serif text-[23px] leading-none tracking-tight">Cutroom</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/">Studio</NavLink>
          <NavLink href="/library">Library</NavLink>
        </nav>
        <Link
          href="/#new"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-paper transition hover:bg-ink-2"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">New video</span>
        </Link>
      </div>
    </header>
  );
}
