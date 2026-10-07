export type PetState = 'IDLE' | 'WALK' | 'RUN' | 'CURIOUS' | 'EXCITED' | 'STUBBORN' | 'SLEEP' | 'JUMP' | 'HIDING' | 'CELEBRATE';
export type ForcedDebugState = PetState | null;
export type Personality = 'playful' | 'calm';
export type PetDirection = 'left' | 'right';
export type CharacterName = 'default';
export type Point = { x:number; y:number };
export type PetCharacterProps = {
  state: PetState;
  direction: PetDirection;
  /** Normalized pointer speed from 0 (still) to 1 (fast). */
  velocity: number;
  movementIntensity: number;
  /** Pointer position in viewport coordinates; the character converts it through SVG transforms. */
  pointerPosition: import('react').RefObject<Point>;
  reducedMotion: boolean;
  distanceToPointer: number;
};
