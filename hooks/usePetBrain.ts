'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForcedDebugState, PetDirection, PetState, Point } from '../components/cursor-pet/pet.types';
import { distance, speedState } from '../lib/pet-behaviour';
import { usePointer } from './usePointer';
import { useIdle } from './useIdle';

const center = (): Point => ({ x: innerWidth * .55, y: innerHeight * .56 });
const normalize = (point: Point): Point => {
  const length = Math.hypot(point.x, point.y) || 1;
  return { x: point.x / length, y: point.y / length };
};

type Options = {
  focusActive: boolean;
  forcedDebugState?: ForcedDebugState;
  enableSleep?: boolean;
  enableStubbornMode?: boolean;
  enableEdgePeek?: boolean;
  celebrate?: boolean;
};

export function usePetBrain({
  focusActive,
  forcedDebugState = null,
  enableSleep = true,
  enableStubbornMode = true,
  enableEdgePeek = true,
  celebrate = false,
}: Options) {
  const position = useRef<Point>({
    x: typeof window === 'undefined' ? 0 : innerWidth * .55,
    y: typeof window === 'undefined' ? 0 : innerHeight * .56,
  });
  const target = useRef<Point>({ x: 0, y: 0 });
  const pointerPosition = useRef<Point>({
    x: typeof window === 'undefined' ? 0 : innerWidth * .5,
    y: typeof window === 'undefined' ? 0 : innerHeight * .5,
  });
  const velocityRef = useRef(0);
  const lastInput = useRef(0);
  const element = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const stubbornUntil = useRef(0);
  const clicks = useRef<number[]>([]);
  const chase = useRef<number[]>([]);
  const awaySince = useRef(0);
  const lastState = useRef<PetState>('IDLE');
  const stubbornBucket = useRef(-1);
  const hidingReason = useRef<'chase' | 'edge' | 'debug'>('edge');
  const timers = useRef<Set<number>>(new Set());

  const [state, setState] = useState<PetState>('IDLE');
  const [direction, setDirection] = useState<PetDirection>('right');
  const [velocity, setVelocity] = useState(0);
  const [distanceToPointer, setDistanceToPointer] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const reducedRef = useRef(false);
  const effectiveState = forcedDebugState ?? state;

  const commit = useCallback((next: PetState) => {
    if (lastState.current !== next) {
      lastState.current = next;
      setState(next);
    }
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      callback();
    }, delay);
    timers.current.add(id);
  }, []);

  const move = useCallback((point: Point, speed: number, now: number) => {
    pointerPosition.current = point;
    velocityRef.current = speed;
    lastInput.current = now;
    setVisible(true);
    setVelocity(Math.max(0, Math.min(1, speed / 1.5)));

    // Continue sampling the pointer while forced, but keep autonomous state from replacing it.
    if (forcedDebugState) return;

    if (lastState.current === 'SLEEP') commit('CURIOUS');
    else if (lastState.current === 'CURIOUS') schedule(() => commit(speedState(speed)), 450);
    else if (lastState.current !== 'STUBBORN' && lastState.current !== 'HIDING' && lastState.current !== 'CELEBRATE') {
      commit(focusActive ? 'IDLE' : speedState(speed));
    }

    if (distance(position.current, point) < 120 && speed > 1.15) {
      chase.current = [...chase.current.filter(time => now - time < 1800), now];
      if (chase.current.length >= 4 && !focusActive) {
        hidingReason.current = 'chase';
        commit('HIDING');
        awaySince.current = 0;
        schedule(() => { if (lastInput.current < now + 800) commit('IDLE'); }, 3600);
        chase.current = [];
      }
    }

    if (enableStubbornMode && target.current.x === 0 && now > stubbornUntil.current && Math.random() < .0007 && !focusActive) {
      stubbornUntil.current = now + 4200;
      commit('STUBBORN');
    }

    if (enableEdgePeek && (point.x < 35 || point.x > innerWidth - 35 || point.y < 35 || point.y > innerHeight - 35) && Math.random() < .0005 && !focusActive) {
      hidingReason.current = 'edge';
      commit('HIDING');
      schedule(() => commit('IDLE'), 1700);
    }
  }, [commit, enableEdgePeek, enableStubbornMode, focusActive, forcedDebugState, schedule]);

  const leave = useCallback((point: Point) => {
    pointerPosition.current = { x: point.x + (point.x < innerWidth / 2 ? -100 : 100), y: point.y };
    if (!forcedDebugState) setVisible(false);
  }, [forcedDebugState]);

  const back = useCallback(() => {
    setVisible(true);
    if (forcedDebugState) return;
    commit('EXCITED');
    schedule(() => commit('IDLE'), 700);
  }, [commit, forcedDebugState, schedule]);

  const click = useCallback((point: Point, now: number) => {
    if (forcedDebugState) return;
    clicks.current = [...clicks.current.filter(time => now - time < 1000), now];
    commit(clicks.current.length >= 3 ? 'EXCITED' : 'JUMP');
    schedule(() => {
      if (!forcedDebugState) commit(focusActive ? 'IDLE' : speedState(velocityRef.current));
    }, clicks.current.length >= 3 ? 800 : 500);
    if (enableStubbornMode && !focusActive && distance(position.current, point) < 130 && now > stubbornUntil.current && Math.random() < .05) {
      stubbornUntil.current = now + 4000;
      commit('STUBBORN');
    }
  }, [commit, enableStubbornMode, focusActive, forcedDebugState, schedule]);

  usePointer(move, leave, back, click);
  useIdle(() => {
    if (enableSleep && !focusActive && !forcedDebugState) commit('SLEEP');
  }, 15000);

  useEffect(() => {
    if (forcedDebugState === 'HIDING') hidingReason.current = 'debug';
    if (forcedDebugState === 'STUBBORN') stubbornUntil.current = Number.POSITIVE_INFINITY;
    if (!forcedDebugState) {
      hidingReason.current = 'edge';
      stubbornUntil.current = 0;
      commit(focusActive ? 'IDLE' : speedState(velocityRef.current));
    }
  }, [forcedDebugState, commit, focusActive]);

  useEffect(() => {
    if (focusActive && !forcedDebugState) commit('IDLE');
  }, [focusActive, forcedDebugState, commit]);

  useEffect(() => {
    if (!celebrate) return;
    commit('CELEBRATE');
    const id = window.setTimeout(() => {
      if (!forcedDebugState) commit('IDLE');
    }, 2600);
    return () => window.clearTimeout(id);
  }, [celebrate, commit, forcedDebugState]);

  useEffect(() => () => {
    timers.current.forEach(id => window.clearTimeout(id));
    timers.current.clear();
  }, []);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => {
      reducedRef.current = media.matches;
      setReducedMotion(media.matches);
    };
    updateMotionPreference();
    media.addEventListener('change', updateMotionPreference);

    let previousTime = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - previousTime) / 16.67, 2);
      previousTime = now;
      const current = position.current;
      const behavior = forcedDebugState ?? lastState.current;
      let desired = pointerPosition.current;
      if (!desired || desired.x < 0) desired = center();

      let holdPosition = Boolean(forcedDebugState && ['IDLE', 'SLEEP', 'STUBBORN', 'EXCITED', 'JUMP', 'CELEBRATE', 'CURIOUS'].includes(forcedDebugState));
      if (!forcedDebugState && !holdPosition && now - lastInput.current > 180 && (lastState.current === 'WALK' || lastState.current === 'RUN')) {
        commit('IDLE');
      }
      if (forcedDebugState === 'WALK' || forcedDebugState === 'RUN') holdPosition = false;

      if (behavior === 'STUBBORN') {
        desired = current;
        holdPosition = true;
        const gap = distance(current, pointerPosition.current);
        const bucket = Math.floor(gap / 16);
        if (bucket !== stubbornBucket.current) {
          stubbornBucket.current = bucket;
          setDistanceToPointer(bucket * 16);
        }
        if (!forcedDebugState && gap > 480) {
          stubbornUntil.current = now;
          commit('RUN');
        }
        if (!forcedDebugState && now >= stubbornUntil.current) commit('RUN');
      }

      if (behavior === 'HIDING' && forcedDebugState === 'HIDING') {
        desired = { x: current.x < innerWidth / 2 ? 4 : innerWidth - 4, y: innerHeight - 10 };
      } else if (behavior === 'HIDING' && hidingReason.current === 'chase') {
        desired = { x: innerWidth * .5, y: innerHeight - 95 };
        if (!forcedDebugState && pointerPosition.current.y < innerHeight - 180) {
          if (!awaySince.current) awaySince.current = now;
          if (now - awaySince.current > 2200) commit('IDLE');
        } else awaySince.current = 0;
      } else if (behavior === 'HIDING' && enableEdgePeek) {
        desired = {
          x: pointerPosition.current.x < innerWidth * .5 ? 2 : innerWidth - 2,
          y: Math.max(90, Math.min(innerHeight - 90, pointerPosition.current.y)),
        };
      }

      const offsetX = desired.x > current.x ? -48 : 48;
      const offsetY = desired.y > current.y ? 30 : -28;
      target.current = holdPosition ? { ...current } : { x: desired.x + offsetX, y: desired.y + offsetY };
      if (behavior === 'HIDING' && (hidingReason.current === 'edge' || hidingReason.current === 'debug')) target.current = { ...desired };

      const travelX = target.current.x - current.x;
      if (Math.abs(travelX) > 4) {
        setDirection(previous => previous === (travelX < 0 ? 'left' : 'right') ? previous : travelX < 0 ? 'left' : 'right');
      }
      const easing = reducedRef.current ? .17 : behavior === 'RUN' ? .12 : .065;
      current.x += (target.current.x - current.x) * Math.min(1, easing * delta);
      current.y += (target.current.y - current.y) * Math.min(1, easing * delta);

      const normalizedSpeed = now - lastInput.current < 180 ? Math.min(1, velocityRef.current / 1.5) : 0;
      setVelocity(previous => Math.abs(previous - normalizedSpeed) > .1 ? normalizedSpeed : previous);

      const elementNode = element.current;
      if (elementNode) {
        const x = Math.max(-18, Math.min(innerWidth - 60, current.x - 24));
        const maxTop = forcedDebugState === 'HIDING' ? innerHeight - 42 : innerHeight - 65;
        const y = Math.max(-10, Math.min(maxTop, current.y - 24));
        elementNode.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
      }
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame.current);
      media.removeEventListener('change', updateMotionPreference);
    };
  }, [commit, enableEdgePeek, forcedDebugState]);

  const movementIntensity = behaviorIntensity(effectiveState);
  return {
    state,
    effectiveState,
    direction,
    velocity,
    movementIntensity,
    pointerPosition,
    reducedMotion,
    distanceToPointer,
    visible,
    element,
    hidingReason,
  };
}

function behaviorIntensity(state: PetState) {
  return state === 'RUN' ? 1 : state === 'WALK' ? .34 : 0;
}
