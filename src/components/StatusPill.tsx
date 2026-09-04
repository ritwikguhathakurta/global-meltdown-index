const COLORS: Record<string, string> = {
  LIVE: "#34c085",
  RECENT: "#3fa9f5",
  STALE: "#e0b93d",
  UNAVAILABLE: "#8b96a8",
  CONFLICTING: "#e05a4d",
};

export function StatusPill({ status }: { status: string }) {
  const color = COLORS[status] ?? "#8b96a8";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{ borderColor: color, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}
