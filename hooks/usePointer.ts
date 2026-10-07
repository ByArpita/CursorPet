'use client';
import { useEffect, useRef } from 'react';
import type { Point } from '../components/cursor-pet/pet.types';

export function usePointer(onMove: (point: Point, speed: number, now: number) => void, onLeave: (point: Point) => void, onReturn: () => void, onClick: (point: Point, now: number) => void) {
  const handlers = useRef({ onMove, onLeave, onReturn, onClick });
  handlers.current = { onMove, onLeave, onReturn, onClick };
  useEffect(() => {
    let last: Point = { x: innerWidth / 2, y: innerHeight / 2 };
    let lastTime = performance.now();
    const move = (e: PointerEvent) => {
      const now = performance.now(), point = { x:e.clientX, y:e.clientY };
      const dt = Math.max(8, now-lastTime), speed = Math.hypot(point.x-last.x, point.y-last.y) / dt;
      last = point; lastTime = now; handlers.current.onMove(point, speed, now);
    };
    const leave = (e: PointerEvent) => { if (e.relatedTarget === null) handlers.current.onLeave(last); };
    const enter = () => handlers.current.onReturn();
    const click = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[aria-label="Pet debug controls"]')) return;
      handlers.current.onClick({ x:e.clientX, y:e.clientY }, performance.now());
    };
    const touch = (e: TouchEvent) => { const t=e.changedTouches[0]; if(t) handlers.current.onMove({x:t.clientX,y:t.clientY},0,performance.now()); };
    window.addEventListener('pointermove',move,{passive:true}); document.addEventListener('pointerout',leave); window.addEventListener('pointerenter',enter); window.addEventListener('click',click,{passive:true}); window.addEventListener('touchstart',touch,{passive:true});
    return () => { window.removeEventListener('pointermove',move); document.removeEventListener('pointerout',leave); window.removeEventListener('pointerenter',enter); window.removeEventListener('click',click); window.removeEventListener('touchstart',touch); };
  }, []);
}
