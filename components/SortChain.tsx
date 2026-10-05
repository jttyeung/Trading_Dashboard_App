"use client";

// Multi-column sort shared by the Open Positions table and the Overview
// watchlist: an ordered chain of {key, dir}, the first entry primary and each
// later one breaking ties left by the ones before it. Each table keeps its own
// comparator (null handling differs between them); this file only owns the
// chain's state transitions and the UI that edits it.
//
// Plain header click keeps the old single-column behavior (flip the primary,
// or sort by that column alone). Shift-click builds the chain on desktop; the
// SortStrip does the same on a tablet, which has no Shift.

export type SortSpec<K extends string> = { key: K; dir: 1 | -1 };
type SetSorts<K extends string> = (next: SortSpec<K>[] | ((prev: SortSpec<K>[]) => SortSpec<K>[])) => void;

export function sortChainActions<K extends string>(sorts: SortSpec<K>[], setSorts: SetSorts<K>) {
  const flip = (k: K) => setSorts((prev) => prev.map((s) => (s.key === k ? { ...s, dir: s.dir === 1 ? -1 : 1 } : s)));
  const add = (k: K) => setSorts((prev) => [...prev.filter((s) => s.key !== k), { key: k, dir: 1 }]);
  // Never empties the chain: the last chip has no × to begin with.
  const remove = (k: K) => setSorts((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== k) : prev));
  const clickHeader = (k: K, additive: boolean) => {
    if (sorts.some((s) => s.key === k) && (additive || sorts[0].key === k)) flip(k);
    else if (additive) add(k);
    else setSorts([{ key: k, dir: 1 }]);
  };
  return { flip, add, remove, clickHeader };
}

// The ▲/▼ after a header label, plus its position in the chain once there's
// more than one key. `idle` is what an unsorted column shows.
export function SortMark<K extends string>({ sorts, k, idle = "" }: { sorts: SortSpec<K>[]; k: K; idle?: string }) {
  const rank = sorts.findIndex((s) => s.key === k);
  if (rank < 0) return <span className="text-[8px]">{idle}</span>;
  return (
    <>
      <span className="text-[8px]">{sorts[rank].dir === 1 ? "▲" : "▼"}</span>
      {sorts.length > 1 && <sup className="text-[8px] text-muted">{rank + 1}</sup>}
    </>
  );
}

// The chain as chips — tap one to flip it, × drops it — with a "then by"
// picker for the touch path.
export function SortStrip<K extends string>({
  sorts,
  setSorts,
  columns,
  className = "",
}: {
  sorts: SortSpec<K>[];
  setSorts: SetSorts<K>;
  columns: { key: K; label: string }[];
  className?: string;
}) {
  const { flip, add, remove } = sortChainActions(sorts, setSorts);
  const labelOf = (k: K) => columns.find((c) => c.key === k)?.label ?? k;
  const unsorted = columns.filter((c) => !sorts.some((s) => s.key === c.key));
  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-[11px] ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Sort</span>
      {sorts.map((s, i) => (
        <span key={s.key} className="inline-flex items-center rounded-lg border border-border bg-surface-2 font-medium">
          <button onClick={() => flip(s.key)} className="flex items-center gap-1 px-2 py-0.5 hover:text-text" title="Flip direction">
            {sorts.length > 1 && <span className="text-[9px] text-muted">{i + 1}</span>}
            {labelOf(s.key)}
            <span className="text-[8px]">{s.dir === 1 ? "▲" : "▼"}</span>
          </button>
          {sorts.length > 1 && (
            <button
              onClick={() => remove(s.key)}
              className="border-l border-border px-1.5 py-0.5 text-muted hover:text-text"
              aria-label={`Remove ${labelOf(s.key)} from sort`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {unsorted.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && add(e.target.value as K)}
          className="rounded-lg border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted"
          aria-label="Add a sort column"
        >
          <option value="">+ then by…</option>
          {unsorted.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      {sorts.length > 1 && (
        <button onClick={() => setSorts([sorts[0]])} className="ml-1 text-muted hover:text-text">
          Clear extras
        </button>
      )}
    </div>
  );
}
