// Back to the dashboard home ("/"). The wide pages (/desktop, /bot, /overview)
// skip the phone-frame chrome, so once you're on one there is no nav back —
// this floats under AllAppsLink (top-4 + h-9 + gap-2 → top-16) to fill that gap.
import Link from "next/link";

export function HomeLink() {
  return (
    <Link
      href="/"
      aria-label="Home"
      title="Home"
      className="fixed left-4 top-16 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm hover:bg-surface-2 hover:text-text"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M10 21v-6h4v6" />
      </svg>
    </Link>
  );
}
