import { useEffect, useRef, useState } from "react";

interface QuestionTimerProps {
  durationSeconds: number;
  active: boolean;
  resetKey: string;
  label: string;
  onRemainingChange?: (remainingSeconds: number) => void;
}

/**
 * The visible meter is the authoritative combat clock. It reports its exact
 * remaining time to the question card, so the speed multiplier and zero-damage
 * cutoff use the same paused countdown that the learner sees.
 */
export function QuestionTimer({ durationSeconds, active, resetKey, label, onRemainingChange }: QuestionTimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const remainingRef = useRef(durationSeconds);
  const previousTick = useRef<number | null>(null);
  const onRemainingChangeRef = useRef(onRemainingChange);

  useEffect(() => {
    onRemainingChangeRef.current = onRemainingChange;
  }, [onRemainingChange]);

  useEffect(() => {
    remainingRef.current = durationSeconds;
    setRemaining(durationSeconds);
    previousTick.current = null;
    onRemainingChangeRef.current?.(durationSeconds);
  }, [durationSeconds, resetKey]);

  useEffect(() => {
    if (!active) {
      previousTick.current = null;
      return;
    }
    previousTick.current = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const previous = previousTick.current ?? now;
      previousTick.current = now;
      const current = remainingRef.current;
      const next = Math.max(0, current - (now - previous) / 1000);
      if (next === current) return;
      remainingRef.current = next;
      setRemaining(next);
      onRemainingChangeRef.current?.(next);
    }, 100);

    return () => window.clearInterval(interval);
  }, [active, resetKey]);

  const percent = Math.max(0, Math.min(100, (remaining / Math.max(1, durationSeconds)) * 100));
  return (
    <div className="timer speed-bonus-meter" aria-label={`${label}: ${Math.ceil(remaining)} seconds`}>
      <div className="timer-topline">
        <span>{label}</span>
        <strong>{active ? `${Math.ceil(remaining)}s` : "—"}</strong>
      </div>
      <div className="timer-track">
        <div className="timer-fill" style={{ width: `${active ? percent : 100}%` }} />
      </div>
    </div>
  );
}
