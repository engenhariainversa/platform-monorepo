"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { LivePointer } from "@repo/types";
import { LASER_IDLE_MS, LASER_MIN_INTERVAL_MS, normalizedPoint } from "./laser";
import { PointerLayer } from "./pointer-layer";

/**
 * Covers the canvas (render it in the `overlay` slot) while the laser is on:
 * shows the dot locally and reports its position, at most ~30 times a second.
 * Hides after 2 s idle or when the mouse leaves. Clicks still reach the stage
 * underneath (they bubble), so click-to-navigate keeps working.
 */
export function LaserSurface({ onMove }: { onMove: (x: number, y: number, visible: boolean) => void }) {
  const [local, setLocal] = useState<LivePointer | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const lastPoint = useRef({ x: 0.5, y: 0.5 });
  const lastSentAt = useRef(0);
  const visible = useRef(false);
  const idleTimer = useRef<number | null>(null);

  const hide = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (!visible.current) return;
    visible.current = false;
    setLocal({ ...lastPoint.current, visible: false });
    onMoveRef.current(lastPoint.current.x, lastPoint.current.y, false);
  };

  // Laser switched off (unmount): the audience must not keep a frozen dot.
  useEffect(() => hide, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const point = normalizedPoint(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
    lastPoint.current = point;
    setLocal({ ...point, visible: true });

    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(hide, LASER_IDLE_MS);

    const now = performance.now();
    const becameVisible = !visible.current;
    if (becameVisible || now - lastSentAt.current >= LASER_MIN_INTERVAL_MS) {
      visible.current = true;
      lastSentAt.current = now;
      onMoveRef.current(point.x, point.y, true);
    }
  };

  return (
    <div className="absolute inset-0 cursor-none" onMouseMove={handleMove} onMouseLeave={hide}>
      <PointerLayer pointer={local} />
    </div>
  );
}
