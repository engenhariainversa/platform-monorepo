/** The laser hides after this long without mouse movement. */
export const LASER_IDLE_MS = 2000;
/** ~30 pointer updates per second, below the server's 40/s throttle. */
export const LASER_MIN_INTERVAL_MS = 33;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Mouse position → 0..1 on the canvas. `rect` is the canvas's on-screen box. */
export function normalizedPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return { x: clamp01((clientX - rect.left) / rect.width), y: clamp01((clientY - rect.top) / rect.height) };
}
