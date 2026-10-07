'use client';
import { useEffect, useRef } from 'react';
export function useIdle(onIdle: () => void, delay = 12000) {
  const cb=useRef(onIdle); cb.current=onIdle;
  useEffect(()=>{ let id=window.setTimeout(()=>cb.current(),delay); const reset=()=>{clearTimeout(id);id=window.setTimeout(()=>cb.current(),delay)}; window.addEventListener('pointermove',reset,{passive:true});window.addEventListener('touchstart',reset,{passive:true});return()=>{clearTimeout(id);window.removeEventListener('pointermove',reset);window.removeEventListener('touchstart',reset)};},[delay]);
}
