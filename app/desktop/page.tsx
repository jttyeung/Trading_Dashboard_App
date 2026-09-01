// Desktop shell for a genuinely different surface: a wide, sortable/groupable
// positions table, not the mobile phone-frame app. app/layout.tsx already
// skips the phone-frame chrome for any /desktop path (see middleware.ts) —
// this page just needs to render its own content, full width.
export const dynamic = "force-dynamic";

export default function DesktopPage() {
  return (
    <main className="min-h-screen w-full bg-bg px-6 py-6 text-text">
      <h1 className="text-xl font-semibold">Desktop</h1>
      <p className="mt-2 text-sm text-muted">Positions table lands here next.</p>
    </main>
  );
}
