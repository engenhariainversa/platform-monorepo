/** "AO VIVO", plus the audience counter when the presenter shows it (`viewerCount` not null). */
export function LiveBadge({ viewerCount }: { viewerCount: number | null }) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-surface-container/90 px-4 py-2 text-sm font-bold text-on-surface shadow-lg backdrop-blur">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
        AO VIVO
      </span>
      {viewerCount !== null && (
        <span className="font-code font-normal tabular-nums text-on-surface-variant">👁 {viewerCount} assistindo</span>
      )}
    </div>
  );
}
