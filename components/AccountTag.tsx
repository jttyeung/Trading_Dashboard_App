// Small account marker on a position row. Only rendered in the Combined View,
// where rows from several accounts sit in one list — a single account's view
// carries no `account` on its positions, so this renders nothing there.
export function AccountTag({ label }: { label?: string | null }) {
  if (!label) return null;
  return (
    <span
      title={`Held in ${label}`}
      className="ml-1 shrink-0 rounded bg-surface-2 px-1 py-0.5 text-[8px] font-medium uppercase tracking-wide text-muted ring-1 ring-inset ring-border"
    >
      {label}
    </span>
  );
}
