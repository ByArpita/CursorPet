'use client';

import { useEffect, useRef } from 'react';

export function useIdle(onIdle: () => void, delay = 12000) {
  const callback = useRef(onIdle);
  callback.current = onIdle;

  useEffect(() => {
    let id = window.setTimeout(() => callback.current(), delay);
    const reset = () => {
      window.clearTimeout(id);
      id = window.setTimeout(() => callback.current(), delay);
    };
    const activityEvents: Array<keyof WindowEventMap> = ['pointermove', 'pointerdown', 'click', 'touchstart'];
    activityEvents.forEach(eventName => window.addEventListener(eventName, reset, { passive: true }));
    return () => {
      window.clearTimeout(id);
      activityEvents.forEach(eventName => window.removeEventListener(eventName, reset));
    };
  }, [delay]);
}
