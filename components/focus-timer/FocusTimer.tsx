'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FocusTimer.module.css';

type Props = {
  onFocusChange?: (active: boolean) => void;
  onComplete?: (durationMinutes: number) => void;
  onReset?: () => void;
  debugCompletion?: boolean;
};

const MIN_DURATION = 1;
const MAX_DURATION = 120;
const STEP_MINUTES = 5;

export default function FocusTimer({ onFocusChange, onComplete, onReset, debugCompletion = false }: Props) {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const end = useRef(0);
  const completed = useRef(false);
  const durationMinutesRef = useRef(durationMinutes);
  const remainingRef = useRef(remaining);
  const onCompleteRef = useRef(onComplete);
  durationMinutesRef.current = durationMinutes;
  remainingRef.current = remaining;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    onFocusChange?.(running);
  }, [running, onFocusChange]);

  useEffect(() => {
    if (!hasSession) setRemaining(durationMinutes * 60);
  }, [durationMinutes, hasSession]);

  useEffect(() => {
    const resetFromEvent = () => {
      setRunning(false);
      setHasSession(false);
      setRemaining(durationMinutes * 60);
      completed.current = false;
      onReset?.();
    };
    window.addEventListener('cursorpet:reset', resetFromEvent);
    return () => window.removeEventListener('cursorpet:reset', resetFromEvent);
  }, [durationMinutes, onReset]);

  useEffect(() => {
    if (!running) return;
    end.current = Date.now() + remainingRef.current * 1000;

    const tick = () => {
      const next = Math.max(0, Math.ceil((end.current - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        if (!completed.current) {
          completed.current = true;
          onCompleteRef.current?.(durationMinutesRef.current);
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const setDuration = (next: number) => {
    const bounded = Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(next)));
    setDurationMinutes(bounded);
    setRemaining(bounded * 60);
  };

  const start = () => {
    if (remaining === 0) setRemaining(durationMinutes * 60);
    completed.current = false;
    setHasSession(true);
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setHasSession(false);
    setRemaining(durationMinutes * 60);
    completed.current = false;
    onReset?.();
  };

  const completeNow = () => {
    completed.current = true;
    setHasSession(true);
    setRunning(false);
    setRemaining(0);
    onCompleteRef.current?.(durationMinutesRef.current);
  };

  const display = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <section className={styles.timer} aria-label="Focus with your pet">
      <div className={styles.label}><span className={styles.pulse} aria-hidden="true" />FOCUS WITH PET</div>
      {!hasSession && (
        <div className={styles.duration}>
          <button type="button" aria-label="Decrease focus duration by 5 minutes" onClick={() => setDuration(durationMinutes - STEP_MINUTES)} disabled={durationMinutes === MIN_DURATION}>−</button>
          <label className={styles.durationValue}>
            <input
              aria-label="Focus duration in minutes"
              type="number"
              min={MIN_DURATION}
              max={MAX_DURATION}
              step="1"
              value={durationMinutes}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                if (Number.isFinite(value) && value >= MIN_DURATION && value <= MAX_DURATION) setDuration(value);
              }}
            />
            <span>min</span>
          </label>
          <button type="button" aria-label="Increase focus duration by 5 minutes" onClick={() => setDuration(durationMinutes + STEP_MINUTES)} disabled={durationMinutes === MAX_DURATION}>+</button>
        </div>
      )}
      {hasSession && <output className={styles.time} aria-live="off" aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds`}>{display}</output>}
      <div className={styles.controls}>
        {!hasSession
          ? <button type="button" onClick={start}>start</button>
          : running
            ? <button type="button" onClick={() => setRunning(false)}>pause</button>
            : <button type="button" onClick={() => setRunning(true)} disabled={remaining === 0}>resume</button>}
        {hasSession && <><span aria-hidden="true">/</span><button type="button" onClick={reset}>reset</button></>}
        {debugCompletion && <><span aria-hidden="true">/</span><button type="button" onClick={completeNow} disabled={remaining === 0}>finish now</button></>}
      </div>
    </section>
  );
}
