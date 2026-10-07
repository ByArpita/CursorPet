'use client';

import { useEffect, useState } from 'react';
import CursorPet from '../components/cursor-pet/CursorPet';
import FocusTimer from '../components/focus-timer/FocusTimer';
import type { ForcedDebugState, PetState } from '../components/cursor-pet/pet.types';
import styles from './page.module.css';

export default function Home() {
  const [debug, setDebug] = useState(false);
  const [forcedDebugState, setForcedDebugState] = useState<ForcedDebugState>(null);
  const [focusActive, setFocusActive] = useState(false);
  const [focusComplete, setFocusComplete] = useState(false);
  const [completedMinutes, setCompletedMinutes] = useState<number | null>(null);
  const [followCursor, setFollowCursor] = useState(true);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => { setDebug(new URLSearchParams(window.location.search).get('debug') === 'true'); }, []);
  useEffect(() => {
    const wake = () => setInteracted(true);
    window.addEventListener('pointermove', wake, { once: true, passive: true });
    window.addEventListener('touchstart', wake, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, []);

  const clearCompletion = () => {
    setFocusComplete(false);
    setCompletedMinutes(null);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.wordmark} href="#home" aria-label="Cursor Pet home"><span className={styles.mark} aria-hidden="true"><i /><i /><i /></span>CURSOR PET</a>
        <span className={styles.edition}>A LITTLE WEB EXPERIMENT&nbsp; · &nbsp;NO. 01</span>
      </header>

      <section className={styles.stage} id="home" aria-label="Meet your cursor companion">
        <div className={styles.intro}>
          <p className={styles.kicker}>A tiny digital companion</p>
          <h1>You brought<br /><em>a friend.</em></h1>
          <p className={styles.lede}>They’re curious about what you’re up to.</p>
        </div>
        <div className={`${styles.hint} ${interacted ? styles.hintGone : ''}`} aria-hidden="true"><span className={styles.hintDot} />move around. it’s watching.</div>
        <div className={styles.stageNote}>A STUDY IN KEEPING COMPANY<br />MADE FOR THE IN-BETWEEN</div>
        <div className={styles.scrollCue} aria-hidden="true"><span />give them a little room</div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerMeta}><span>TAKE A BREATH</span><span className={styles.footerDot}>✳</span><span>STAY A WHILE</span></div>
        <div className={styles.footerTools}>
          <FocusTimer
            onFocusChange={setFocusActive}
            onComplete={(minutes) => { setCompletedMinutes(minutes); setFocusComplete(true); }}
            onReset={clearCompletion}
            debugCompletion={debug}
          />
          <div className={styles.followControl}>
            <span>Follow cursor</span>
            <button
              className={styles.followToggle}
              type="button"
              aria-label={`Follow cursor: ${followCursor ? 'On' : 'Off'}`}
              aria-pressed={followCursor}
              onClick={() => setFollowCursor(value => !value)}
            >
              <span className={styles.followDot} aria-hidden="true" />{followCursor ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        <div className={styles.footerEnd}><span>DESIGNED TO FOLLOW</span><span>2026</span></div>
      </footer>

      <CursorPet
        personality="playful"
        enableSleep
        enableStubbornMode
        enableEdgePeek
        focusActive={focusActive}
        celebrate={focusComplete}
        followCursor={followCursor}
        forcedDebugState={debug ? forcedDebugState : null}
      />
      {focusComplete && <div className={styles.completion} role="status"><span>✳</span> good job. we survived {completedMinutes ?? 25} {completedMinutes === 1 ? 'minute' : 'minutes'}. <button onClick={() => { clearCompletion(); window.dispatchEvent(new Event('cursorpet:reset')); }}>take a tiny break →</button></div>}
      {debug && <div className={styles.debug} aria-label="Pet debug controls"><span>debug /</span><button type="button" onClick={() => setForcedDebugState(null)} aria-pressed={forcedDebugState === null}>normal / auto</button>{(['IDLE', 'WALK', 'RUN', 'JUMP', 'SLEEP', 'STUBBORN', 'EXCITED', 'HIDING', 'CELEBRATE', 'CURIOUS'] as PetState[]).map((s) => <button type="button" key={s} onClick={() => setForcedDebugState(s)} aria-pressed={forcedDebugState === s}>{s.toLowerCase()}</button>)}</div>}
    </main>
  );
}
