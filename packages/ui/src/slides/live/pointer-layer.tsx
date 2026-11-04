import type { LivePointer } from "@repo/types";

/**
 * The laser dot. Rendered in the canvas overlay, so `left`/`top` percentages
 * are relative to the 1920×1080 surface and the 28px size scales with it.
 */
export function PointerLayer({ pointer }: { pointer: LivePointer | null }) {
  if (!pointer) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute h-[28px] w-[28px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container"
      style={{
        left: `${pointer.x * 100}%`,
        top: `${pointer.y * 100}%`,
        opacity: pointer.visible ? 1 : 0,
        boxShadow: "0 0 32px 12px rgba(255, 183, 131, 0.55)",
        // ~60 ms interpolation between network updates.
        transition: "left 60ms linear, top 60ms linear, opacity 200ms ease-out",
      }}
    />
  );
}
