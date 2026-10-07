'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './FocusTimer.module.css';
type Props={onFocusChange?:(active:boolean)=>void;onComplete?:()=>void;durationSeconds?:number};
export default function FocusTimer({onFocusChange,onComplete,durationSeconds=25*60}:Props){
 const [remaining,setRemaining]=useState(durationSeconds),[running,setRunning]=useState(false);const end=useRef(0),completed=useRef(false),lastDuration=useRef(durationSeconds);
 useEffect(()=>{onFocusChange?.(running);},[running,onFocusChange]);
 useEffect(()=>{if(lastDuration.current!==durationSeconds){lastDuration.current=durationSeconds;if(!running)setRemaining(durationSeconds)}},[durationSeconds,running]);
 useEffect(()=>{const reset=()=>{setRunning(false);setRemaining(durationSeconds);completed.current=false};window.addEventListener('cursorpet:reset',reset);return()=>window.removeEventListener('cursorpet:reset',reset)},[durationSeconds]);
 useEffect(()=>{if(!running)return;end.current=Date.now()+remaining*1000;const tick=()=>{const next=Math.max(0,Math.ceil((end.current-Date.now())/1000));setRemaining(next);if(next===0){setRunning(false);if(!completed.current){completed.current=true;onComplete?.()}}};tick();const id=window.setInterval(tick,250);return()=>window.clearInterval(id)},[running,onComplete]);
 const start=()=>{if(remaining===0)setRemaining(durationSeconds);completed.current=false;setRunning(true)};
 const reset=()=>{setRunning(false);setRemaining(durationSeconds);completed.current=false};
 const display=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
 return <section className={styles.timer} aria-label="Focus with your pet"><div className={styles.label}><span className={styles.pulse} aria-hidden="true"/>FOCUS WITH PET</div><output className={styles.time} aria-live="off" aria-label={`${Math.floor(remaining/60)} minutes ${remaining%60} seconds`}>{display}</output><div className={styles.controls}>{running?<button onClick={()=>setRunning(false)}>pause</button>:<button onClick={start}>{remaining===durationSeconds?'start':remaining===0?'again':'resume'}</button>}<span aria-hidden="true">/</span><button onClick={reset}>reset</button></div></section>
}
