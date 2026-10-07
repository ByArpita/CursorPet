'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { PetCharacterProps, Point } from '../../pet.types';
import styles from './DefaultPet.module.css';

function Eyes({ pointerPosition, sleeping, curious, excited }: { pointerPosition: RefObject<Point>; sleeping: boolean; curious: boolean; excited: boolean }) {
  const left = useRef<SVGCircleElement>(null);
  const right = useRef<SVGCircleElement>(null);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let timer = 0;
    let open = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlinking(true);
        open = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 110);
      }, 2600 + Math.random() * 3400);
    };
    if (sleeping) setBlinking(false);
    else schedule();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(open);
    };
  }, [sleeping]);

  useEffect(() => {
    let frame = 0;

    const track = () => {
      const pointer = pointerPosition.current;
      const svg = left.current?.ownerSVGElement;
      const eyes = left.current?.parentElement as SVGGElement | null;
      const screenMatrix = eyes?.getScreenCTM();

      if (pointer && svg && screenMatrix) {
        const screenPoint = svg.createSVGPoint();
        screenPoint.x = pointer.x;
        screenPoint.y = pointer.y;
        const localPointer = screenPoint.matrixTransform(screenMatrix.inverse());

        // Keep the pupil fully inside its sclera while following the screen-space pointer.
        // Eye radii are 4.8 × 5.8 and each pupil radius is 2.7. Keep a 0.2
        // unit inset so the pupil approaches the edge without crossing the sclera.
        const maxX = 4.8 - 2.7 - 0.2;
        const maxY = 5.8 - 2.7 - 0.2;
        const placePupil = (pupil: SVGCircleElement | null, centerX: number) => {
          if (!pupil) return;
          const dx = localPointer.x - centerX;
          const dy = localPointer.y;
          const length = Math.hypot(dx, dy);
          const unitX = dx / (length || 1);
          const unitY = dy / (length || 1);
          const edgeTravel = 1 / Math.sqrt((unitX / maxX) ** 2 + (unitY / maxY) ** 2);
          // Ease toward the safe edge, reaching about 95% of the available
          // travel within 30 local SVG units of pointer distance.
          const travel = edgeTravel * (1 - Math.exp(-length / 10));
          pupil.setAttribute('cx', String(centerX + unitX * travel));
          pupil.setAttribute('cy', String(unitY * travel));
        };

        placePupil(left.current, -7);
        placePupil(right.current, 7);
      }

      frame = requestAnimationFrame(track);
    };

    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
  }, [pointerPosition]);

  const closed = sleeping || blinking;
  const eyeRadius = curious ? 6.5 : excited ? 5.5 : 4.8;
  return <g className={styles.eyes}>
    <ellipse cx="-7" cy="0" rx={eyeRadius} ry={closed ? 1.15 : curious ? 6.5 : 5.8} />
    <ellipse cx="7" cy="0" rx={eyeRadius} ry={closed ? 1.15 : curious ? 6.5 : 5.8} />
    {!closed && <><circle ref={left} cx="-7" cy="0" r="2.7" /><circle ref={right} cx="7" cy="0" r="2.7" /></>}
    {sleeping && <path d="M-11 0q4 3 8 0M3 0q4 3 8 0" className={styles.sleepLines} />}
  </g>;
}

export default function DefaultPet({ state, direction, velocity, movementIntensity, pointerPosition, reducedMotion, distanceToPointer }: PetCharacterProps) {
  const sleeping = state === 'SLEEP';
  const excited = state === 'EXCITED' || state === 'CELEBRATE';
  const curious = state === 'CURIOUS';
  const stubborn = state === 'STUBBORN';
  const face = stubborn && distanceToPointer > 280;
  const className = [styles.character, styles[state.toLowerCase()], styles[direction], reducedMotion ? styles.reduced : ''].filter(Boolean).join(' ');

  const runDuration = `${Math.max(.16, .32 - velocity * .16)}s`;
  return <svg className={className} viewBox="-39 -50 78 90" aria-hidden="true" style={{ '--movement': movementIntensity, '--run-duration': runDuration } as CSSProperties}>
    {state === 'CELEBRATE' && <g className={styles.confetti}><path d="M-25-27l3-4m42 5 3-4M-29 1l-4-1m57 2 4-1" /></g>}
    <ellipse className={styles.shadow} cx="0" cy="32" rx="19" ry="4" />
    <g className={styles.body}>
      <g transform={direction === 'left' ? 'scale(-1 1)' : undefined}>
        <path className={styles.shell} d="M-23 14C-26-1-21-23-10-31c7-5 15-4 22 0 12 8 17 26 11 43-3 9-12 14-22 13S-21 24-23 14Z" />
        <path className={styles.highlight} d="M-17-21q4-9 11-11M7-31q6 3 9 9" />
        <g className={styles.antenna}>
          <path d="M-5-29C-8-35-10-39-7-44" />
          <path d="M-8-41C-15-43-16-48-12-48C-8-49-5-46-6-42" />
        </g>
      </g>
      <g transform="translate(0,-5)"><Eyes pointerPosition={pointerPosition} sleeping={sleeping} curious={curious} excited={excited} /></g>
      {sleeping
        ? <path className={styles.mouth} d="M-3 12q3 2 6 0" />
        : face
          ? <path className={styles.mouth} d="M-4 15q4-4 8 0" />
          : <path className={styles.mouth} d={stubborn ? 'M-4 15q4-4 8 0' : excited ? 'M-4 9q4 6 8 0' : 'M-3 12q3 2 6 0'} />}
      <ellipse className={styles.blush} cx="-22" cy="8" rx="3" ry="2" />
      <ellipse className={styles.blush} cx="22" cy="8" rx="3" ry="2" />
    </g>
    <g className={styles.feet}><ellipse cx="-11" cy="28" rx="5" ry="3" /><ellipse cx="11" cy="28" rx="5" ry="3" /></g>
  </svg>;
}
