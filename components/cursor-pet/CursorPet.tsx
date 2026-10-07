'use client';
import { useEffect } from 'react';
import { usePetBrain } from '../../hooks/usePetBrain';
import type { CharacterName, ForcedDebugState, Personality } from './pet.types';
import { characters } from './characters/registry';
import styles from './CursorPet.module.css';
type Props={character?:CharacterName;personality?:Personality;enableSleep?:boolean;enableStubbornMode?:boolean;enableEdgePeek?:boolean;focusActive?:boolean;followCursor?:boolean;celebrate?:boolean;forcedDebugState?:ForcedDebugState};
export default function CursorPet({character='default',personality='playful',enableSleep=true,enableStubbornMode=true,enableEdgePeek=true,focusActive=false,followCursor=true,celebrate=false,forcedDebugState=null}:Props){
 const {effectiveState,direction,velocity,movementIntensity,pointerPosition,reducedMotion,distanceToPointer,visible,element,hidingReason}=usePetBrain({focusActive,followCursor,forcedDebugState,enableSleep,enableStubbornMode,enableEdgePeek,celebrate});
 const Character=characters[character];
 const reactionClass = effectiveState==='JUMP' ? styles.jumpReaction : effectiveState==='EXCITED' ? styles.excitedReaction : effectiveState==='CELEBRATE' ? styles.celebrateReaction : '';
 return <div ref={element} className={`${styles.pet} ${effectiveState==='HIDING'&&(hidingReason.current==='chase'||hidingReason.current==='debug')?styles.behindTimer:''} ${visible?'':'isGone'}`} aria-hidden="true" data-state={effectiveState}>
   <div className={`${styles.petReaction} ${reactionClass} ${reducedMotion?styles.reducedMotion:''}`}>
     <Character state={effectiveState} direction={direction} velocity={velocity} movementIntensity={personality==='calm'?movementIntensity*.45:movementIntensity} pointerPosition={pointerPosition} reducedMotion={reducedMotion} distanceToPointer={distanceToPointer}/>
   </div>
   {effectiveState==='SLEEP'&&<span className={styles.zzz}>z<span>z</span></span>}
   {effectiveState==='HIDING'&&hidingReason.current==='chase'&&<span className={styles.chaseCopy}>stop chasing me 😭</span>}
 </div>;
}
