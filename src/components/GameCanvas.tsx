'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { STYLES } from '../looks/registry';
import { EngineStore } from './engineStore';
import css from './game.module.css';
import { Hud } from './Hud';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [store] = useState(() => new EngineStore(STYLES));
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    store.attach(canvas);
    return () => store.detach();
  }, [store]);

  return (
    <main className={css.root}>
      <canvas ref={canvasRef} className={css.canvas} />
      {snap.pronto && <Hud store={store} snap={snap} />}
      {snap.erro && <div className={css.erro}>{snap.erro}</div>}
    </main>
  );
}
