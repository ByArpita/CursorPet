'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForcedDebugState, PetDirection, PetState, Point } from '../components/cursor-pet/pet.types';
import { distance, speedState } from '../lib/pet-behaviour';
import { usePointer } from './usePointer';
import { useIdle } from './useIdle';

type HidePhase = 'flee' | 'hidden' | 'peek';
type CursorMotion = { point: Point; direction: Point; segmentLength: number; gap: number };

const center = (): Point => ({ x: innerWidth * .55, y: innerHeight * .56 });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type Options = {
  focusActive: boolean;
  followCursor?: boolean;
  forcedDebugState?: ForcedDebugState;
  enableSleep?: boolean;
  enableStubbornMode?: boolean;
  enableEdgePeek?: boolean;
  celebrate?: boolean;
};

export function usePetBrain({
  focusActive,
  followCursor = true,
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
  const clicks = useRef<number[]>([]);
  const pointerPosition = useRef<Point>({
    x: typeof window === 'undefined' ? 0 : innerWidth * .5,
    y: typeof window === 'undefined' ? 0 : innerHeight * .5,
  });
  const velocityRef = useRef(0);
  const lastInput = useRef(0);
  const element = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const lastState = useRef<PetState>('IDLE');
  const cursorMotion = useRef<CursorMotion | null>(null);
  const stubbornPulls = useRef<number[]>([]);
  const stubbornUntil = useRef(0);
  const stubbornEscapeAllowedAt = useRef(0);
  const stubbornCooldownUntil = useRef(0);
  const lastPullAt = useRef(0);
  const pullCandidate = useRef<{ at: number; gap: number } | null>(null);
  const chaseApproaches = useRef<number[]>([]);
  const lastApproachAt = useRef(0);
  const hidingCooldownUntil = useRef(0);
  const hidePhase = useRef<HidePhase>('flee');
  const hidePhaseAt = useRef(0);
  const awaySince = useRef(0);
  const edgeDwellSince = useRef(0);
  const edgeReturn = useRef(false);
  const followCatchUp = useRef(false);
  const edgeCooldownUntil = useRef(0);
  const chaseRecovery = useRef(false);
  const hidingReason = useRef<'chase' | 'edge' | 'debug'>('edge');
  const timers = useRef(new Map<string, number>());

  const [state, setState] = useState<PetState>('IDLE');
  const [direction, setDirection] = useState<PetDirection>('right');
  const [velocity, setVelocity] = useState(0);
  const [distanceToPointer, setDistanceToPointer] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const reducedRef = useRef(false);
  const previousFollowCursor = useRef(followCursor);
  const effectiveState = forcedDebugState ?? state;

  const cancelTimer = useCallback((key: string) => {
    const id = timers.current.get(key);
    if (id !== undefined) {
      window.clearTimeout(id);
      timers.current.delete(key);
    }
  }, []);

  const schedule = useCallback((key: string, callback: () => void, delay: number) => {
    cancelTimer(key);
    const id = window.setTimeout(() => {
      timers.current.delete(key);
      callback();
    }, delay);
    timers.current.set(key, id);
  }, [cancelTimer]);

  const cancelTransientTimers = useCallback(() => {
    cancelTimer('wake');
    cancelTimer('reaction');
    cancelTimer('celebrate');
  }, [cancelTimer]);

  const commit = useCallback((next: PetState) => {
    if (lastState.current === next) return;
    if (next !== 'CURIOUS') cancelTimer('wake');
    if (next !== 'JUMP' && next !== 'EXCITED') cancelTimer('reaction');
    if (next !== 'CELEBRATE') cancelTimer('celebrate');
    lastState.current = next;
    setState(next);
  }, [cancelTimer]);

  const returnToAutonomy = useCallback((now: number) => {
    chaseRecovery.current = false;
    const recentMovement = now - lastInput.current < 220;
    commit(followCursor && !focusActive && recentMovement ? speedState(velocityRef.current) : 'IDLE');
  }, [commit, focusActive, followCursor]);

  const beginWake = useCallback(() => {
    commit('CURIOUS');
    schedule('wake', () => {
      if (lastState.current === 'CURIOUS') returnToAutonomy(performance.now());
    }, 650);
  }, [commit, returnToAutonomy, schedule]);

  const beginHiding = useCallback((reason: 'chase' | 'edge', now: number) => {
    hidingReason.current = reason;
    hidePhase.current = 'flee';
    hidePhaseAt.current = now;
    awaySince.current = 0;
    edgeDwellSince.current = 0;
    edgeReturn.current = false;
    chaseRecovery.current = false;
    if (reason === 'chase') hidingCooldownUntil.current = now + 25000;
    if (reason === 'edge') edgeCooldownUntil.current = now + 18000;
    commit('HIDING');
  }, [commit]);

  const recordPull = useCallback((now: number) => {
    if (!followCursor || !enableStubbornMode || forcedDebugState) return;
    stubbornPulls.current = [...stubbornPulls.current.filter(time => now - time <= 10000), now];
    if (
      stubbornPulls.current.length >= 5 &&
      now >= stubbornCooldownUntil.current &&
      !focusActive &&
      !forcedDebugState &&
      !['HIDING', 'STUBBORN', 'CELEBRATE', 'EXCITED', 'JUMP'].includes(lastState.current)
    ) {
      stubbornCooldownUntil.current = now + 20000;
      stubbornUntil.current = now + 3200;
      stubbornEscapeAllowedAt.current = now + 650;
      stubbornPulls.current = [];
      commit('STUBBORN');
    }
  }, [commit, enableStubbornMode, focusActive, followCursor, forcedDebugState]);

  const move = useCallback((point: Point, speed: number, now: number) => {
    pointerPosition.current = point;
    velocityRef.current = followCursor ? speed : 0;
    lastInput.current = now;
    setVisible(true);
    setVelocity(followCursor ? Math.max(0, Math.min(1, speed / 1.5)) : 0);

    const previous = cursorMotion.current;
    const dx = previous ? point.x - previous.point.x : 0;
    const dy = previous ? point.y - previous.point.y : 0;
    const step = Math.hypot(dx, dy);
    const directionNow = step > 0 ? { x: dx / step, y: dy / step } : { x: 0, y: 0 };
    const previousDirection = previous?.direction ?? { x: 0, y: 0 };
    const dot = directionNow.x * previousDirection.x + directionNow.y * previousDirection.y;
    const gap = distance(position.current, point);
    const previousGap = previous?.gap ?? gap;
    let segmentLength = previous?.segmentLength ?? 0;

    if (followCursor && !forcedDebugState && enableStubbornMode && step >= 3) {
      if (previous && dot < -.45) {
        if (previous.segmentLength >= 55 && step >= 18 && speed >= .12) {
          if (previous.gap >= 135 && now - lastPullAt.current >= 80) {
            recordPull(now);
            lastPullAt.current = now;
            pullCandidate.current = null;
          } else {
            pullCandidate.current = { at: now, gap: previous.gap };
          }
        }
        segmentLength = step;
      } else if (previous && dot > .6) {
        segmentLength += step;
      } else {
        segmentLength = step;
      }
    }

    const candidate = pullCandidate.current;
    if (followCursor && !forcedDebugState && candidate) {
      if (now - candidate.at > 1200) pullCandidate.current = null;
      else if (gap >= 135 && gap >= candidate.gap + 60 && now - lastPullAt.current >= 300) {
        recordPull(now);
        lastPullAt.current = now;
        pullCandidate.current = null;
      }
    }

    cursorMotion.current = { point, direction: step >= 3 ? directionNow : previousDirection, segmentLength, gap };

    if (forcedDebugState) return;
    const current = lastState.current;

    if (current === 'SLEEP') {
      beginWake();
      return;
    }
    if (current === 'CURIOUS') return;
    if (['HIDING', 'STUBBORN', 'CELEBRATE', 'EXCITED', 'JUMP'].includes(current)) return;
    if (!followCursor) return;
    if (chaseRecovery.current) {
      commit('RUN');
      return;
    }

    if (
      previous &&
      speed >= .65 &&
      previousGap > 165 &&
      gap < 112 &&
      now - lastApproachAt.current >= 300 &&
      now >= hidingCooldownUntil.current &&
      !focusActive
    ) {
      chaseApproaches.current = [...chaseApproaches.current.filter(time => now - time <= 4500), now];
      lastApproachAt.current = now;
      if (chaseApproaches.current.length >= 3) {
        chaseApproaches.current = [];
        beginHiding('chase', now);
        return;
      }
    }

    commit(focusActive ? 'IDLE' : speedState(speed));
  }, [beginHiding, beginWake, commit, enableStubbornMode, focusActive, followCursor, forcedDebugState, recordPull]);

  const leave = useCallback((point: Point) => {
    pointerPosition.current = { x: point.x + (point.x < innerWidth / 2 ? -100 : 100), y: point.y };
    if (!forcedDebugState) setVisible(false);
  }, [forcedDebugState]);

  const startReaction = useCallback((next: 'JUMP' | 'EXCITED', duration: number) => {
    if (['HIDING', 'STUBBORN', 'CELEBRATE'].includes(lastState.current)) return;
    commit(next);
    schedule('reaction', () => {
      if (lastState.current === next) returnToAutonomy(performance.now());
    }, duration);
  }, [commit, returnToAutonomy, schedule]);

  const back = useCallback(() => {
    const now = performance.now();
    lastInput.current = now;
    setVisible(true);
    if (forcedDebugState) return;
    startReaction('EXCITED', 700);
  }, [forcedDebugState, startReaction]);

  const click = useCallback((point: Point, now: number) => {
    pointerPosition.current = point;
    lastInput.current = now;
    setVisible(true);
    if (forcedDebugState || ['HIDING', 'STUBBORN', 'CELEBRATE'].includes(lastState.current)) return;

    clicks.current = [...clicks.current.filter(time => now - time < 1000), now];
    if (clicks.current.length >= 3) {
      clicks.current = [];
      startReaction('EXCITED', 900);
    } else {
      startReaction('JUMP', 580);
    }
  }, [forcedDebugState, startReaction]);

  usePointer(move, leave, back, click);
  useIdle(() => {
    if (enableSleep && !focusActive && !forcedDebugState) commit('SLEEP');
  }, 15000);

  useEffect(() => {
    if (forcedDebugState) {
      cancelTransientTimers();
      stubbornPulls.current = [];
      pullCandidate.current = null;
      chaseApproaches.current = [];
      edgeDwellSince.current = 0;
      chaseRecovery.current = false;
      if (forcedDebugState === 'HIDING') hidingReason.current = 'debug';
      if (forcedDebugState === 'STUBBORN') stubbornUntil.current = Number.POSITIVE_INFINITY;
      return;
    }

    hidingReason.current = 'edge';
    stubbornUntil.current = 0;
    chaseRecovery.current = false;
    commit(!followCursor || focusActive ? 'IDLE' : speedState(velocityRef.current));
  }, [forcedDebugState, commit, focusActive, followCursor, cancelTransientTimers]);

  useEffect(() => {
    const wasFollowing = previousFollowCursor.current;
    previousFollowCursor.current = followCursor;
    if (wasFollowing === followCursor) return;

    stubbornPulls.current = [];
    pullCandidate.current = null;
    chaseApproaches.current = [];
    edgeDwellSince.current = 0;
    edgeReturn.current = false;
    chaseRecovery.current = false;
    if (!followCursor) {
      followCatchUp.current = false;
      if (forcedDebugState) return;
      if (
        lastState.current === 'WALK' ||
        lastState.current === 'RUN' ||
        lastState.current === 'STUBBORN' ||
        (lastState.current === 'HIDING' && hidingReason.current !== 'debug')
      ) {
        cancelTransientTimers();
        commit('IDLE');
      }
      return;
    }

    if (forcedDebugState) return;
    const gap = distance(position.current, pointerPosition.current);
    followCatchUp.current = !focusActive && gap > 80;
    if (focusActive) commit('IDLE');
    else if (followCatchUp.current) commit(gap > 235 ? 'RUN' : 'WALK');
    else commit(speedState(velocityRef.current));
  }, [followCursor, forcedDebugState, focusActive, commit, cancelTransientTimers]);

  useEffect(() => {
    if (!focusActive || forcedDebugState) return;
    if (!['HIDING', 'STUBBORN', 'JUMP', 'EXCITED', 'CELEBRATE'].includes(lastState.current)) commit('IDLE');
  }, [focusActive, forcedDebugState, commit]);

  useEffect(() => {
    if (!celebrate) return;
    if (!['HIDING', 'STUBBORN'].includes(lastState.current)) {
      commit('CELEBRATE');
      schedule('celebrate', () => {
        if (lastState.current === 'CELEBRATE') returnToAutonomy(performance.now());
      }, 2600);
    }
    return () => cancelTimer('celebrate');
  }, [celebrate, commit, forcedDebugState, returnToAutonomy, schedule, cancelTimer]);

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
      const forcedFollowState = Boolean(forcedDebugState && ['WALK', 'RUN', 'HIDING'].includes(forcedDebugState));
      const followMovementEnabled = followCursor || forcedFollowState;

      let holdPosition = Boolean(
        forcedDebugState &&
        ['IDLE', 'SLEEP', 'STUBBORN', 'EXCITED', 'JUMP', 'CELEBRATE', 'CURIOUS'].includes(forcedDebugState)
      );
      if (
        !forcedDebugState &&
        followCursor &&
        !followCatchUp.current &&
        !chaseRecovery.current &&
        now - lastInput.current > 180 &&
        (lastState.current === 'WALK' || lastState.current === 'RUN')
      ) commit('IDLE');
      if (forcedDebugState === 'WALK' || forcedDebugState === 'RUN') holdPosition = false;

      if (behavior === 'STUBBORN') {
        const gap = distance(current, pointerPosition.current);
        setDistanceToPointer(previous => Math.abs(previous - gap) > 16 ? gap : previous);
        desired = current;
        holdPosition = true;
        if (!forcedDebugState && gap > 500 && now >= stubbornEscapeAllowedAt.current) {
          stubbornUntil.current = now;
          chaseRecovery.current = true;
          commit('RUN');
        } else if (!forcedDebugState && now >= stubbornUntil.current) {
          returnToAutonomy(now);
        }
      } else if (!forcedDebugState && followCursor && chaseRecovery.current) {
        if (distance(current, pointerPosition.current) <= 135) returnToAutonomy(now);
        else {
          desired = pointerPosition.current;
          holdPosition = false;
        }
      }

      const hiding = behavior === 'HIDING';
      if (hiding && forcedDebugState === 'HIDING') {
        desired = { x: current.x < innerWidth / 2 ? 4 : innerWidth - 4, y: innerHeight - 10 };
      } else if (hiding && hidingReason.current === 'chase') {
        const safeSpot = { x: innerWidth * .5, y: innerHeight - 95 };
        desired = safeSpot;
        if (hidePhase.current === 'flee' && distance(current, safeSpot) < 42) {
          hidePhase.current = 'hidden';
          hidePhaseAt.current = now;
        }
        if (hidePhase.current === 'hidden') {
          const backedAway = distance(pointerPosition.current, current) > 260 || now - lastInput.current > 850;
          if (backedAway) {
            if (!awaySince.current) awaySince.current = now;
            if (now - awaySince.current >= 700) {
              hidePhase.current = 'peek';
              hidePhaseAt.current = now;
            }
          } else awaySince.current = 0;
        }
        if (hidePhase.current === 'peek' && now - hidePhaseAt.current >= 900) {
          hidingReason.current = 'edge';
          commit('CURIOUS');
          schedule('wake', () => {
            if (lastState.current === 'CURIOUS') returnToAutonomy(performance.now());
          }, 650);
        }
      } else if (hiding && hidingReason.current === 'edge') {
        const edgeX = pointerPosition.current.x < innerWidth / 2 ? -25 : innerWidth - 25;
        const edgeTarget = { x: edgeX, y: clamp(pointerPosition.current.y, 90, innerHeight - 90) };
        desired = edgeTarget;
        if (hidePhase.current === 'flee' && distance(current, edgeTarget) < 42) {
          hidePhase.current = 'peek';
          hidePhaseAt.current = now;
        }
        if (hidePhase.current === 'peek' && now - hidePhaseAt.current >= 900) {
          edgeReturn.current = true;
          commit('CURIOUS');
          schedule('wake', () => {
            if (lastState.current === 'CURIOUS') returnToAutonomy(performance.now());
          }, 650);
        }
      }

      if (
        enableEdgePeek &&
        followCursor &&
        !forcedDebugState &&
        !focusActive &&
        now >= edgeCooldownUntil.current &&
        !chaseRecovery.current &&
        ['IDLE', 'WALK', 'RUN'].includes(lastState.current) &&
        now - lastInput.current < 2500
      ) {
        const pointerNearLeft = pointerPosition.current.x < 28;
        const pointerNearRight = pointerPosition.current.x > innerWidth - 28;
        const pointerNearTop = pointerPosition.current.y < 28;
        const pointerNearBottom = pointerPosition.current.y > innerHeight - 28;
        const petAtSameEdge =
          (pointerNearLeft && current.x < 125) ||
          (pointerNearRight && current.x > innerWidth - 125) ||
          (pointerNearTop && current.y < 125) ||
          (pointerNearBottom && current.y > innerHeight - 125);
        if ((pointerNearLeft || pointerNearRight || pointerNearTop || pointerNearBottom) && petAtSameEdge) {
          if (!edgeDwellSince.current) edgeDwellSince.current = now;
          if (now - edgeDwellSince.current >= 1500) beginHiding('edge', now);
        } else edgeDwellSince.current = 0;
      } else if (!hiding) edgeDwellSince.current = 0;

      const offsetX = desired.x > current.x ? -48 : 48;
      const offsetY = desired.y > current.y ? 30 : -28;
      if (!followMovementEnabled) {
        desired = current;
        holdPosition = true;
      }
      target.current = holdPosition ? { ...current } : { x: desired.x + offsetX, y: desired.y + offsetY };
      if (behavior === 'HIDING' && followMovementEnabled) target.current = { ...desired };
      else if (edgeReturn.current && !forcedDebugState && followCursor) {
        const returnTarget = {
          x: clamp(pointerPosition.current.x, 80, innerWidth - 80),
          y: clamp(pointerPosition.current.y, 65, innerHeight - 65),
        };
        target.current = returnTarget;
        if (distance(current, returnTarget) < 12) edgeReturn.current = false;
      }

      const travelX = target.current.x - current.x;
      if (Math.abs(travelX) > 4) {
        const nextDirection: PetDirection = travelX < 0 ? 'left' : 'right';
        setDirection(previous => previous === nextDirection ? previous : nextDirection);
      }

      const fleeing = behavior === 'HIDING' && hidePhase.current === 'flee';
      const easing = reducedRef.current ? .17 : fleeing ? .14 : behavior === 'RUN' ? .12 : .065;
      current.x += (target.current.x - current.x) * Math.min(1, easing * delta);
      current.y += (target.current.y - current.y) * Math.min(1, easing * delta);

      if (followCatchUp.current && distance(current, pointerPosition.current) <= 80) {
        followCatchUp.current = false;
        if (!forcedDebugState) commit(focusActive ? 'IDLE' : speedState(velocityRef.current));
      }

      const normalizedSpeed = followCursor && now - lastInput.current < 180 ? Math.min(1, velocityRef.current / 1.5) : 0;
      setVelocity(previous => Math.abs(previous - normalizedSpeed) > .1 ? normalizedSpeed : previous);

      const elementNode = element.current;
      if (elementNode) {
        const edgePeek = behavior === 'HIDING' && hidingReason.current === 'edge';
        const x = clamp(current.x - 24, edgePeek ? -49 : -18, edgePeek ? innerWidth - 9 : innerWidth - 60);
        const maxTop = forcedDebugState === 'HIDING' ? innerHeight - 42 : innerHeight - 65;
        const y = clamp(current.y - 24, -10, maxTop);
        elementNode.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
      }
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame.current);
      media.removeEventListener('change', updateMotionPreference);
    };
  }, [beginHiding, commit, enableEdgePeek, focusActive, followCursor, forcedDebugState, returnToAutonomy, schedule]);

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
