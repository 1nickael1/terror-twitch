'use client';

import { useEffect, useState } from 'react';
import { STYLES } from '../looks/registry';
import type { EngineStore, HudSnapshot } from './engineStore';
import css from './game.module.css';

export const AJUDA =
  'Clique na tela para jogar · WASD andar · Shift correr · Mouse ou setas olhar · Clique ou Espaço atirar · 1–4 estilo · R reiniciar · Esc soltar o mouse';

/** Conforme o bloco de licença da página do artigo na SCP Wiki. */
const AUTOR_096 = 'Dr Dan';

export interface HudProps {
  store: EngineStore;
  snap: HudSnapshot;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

function useSegundos(): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setS((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return s;
}

function useRelogio(): string {
  const [hora, setHora] = useState('--:--:--');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setHora(`${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:${doisDigitos(d.getSeconds())}`);
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return hora;
}

function OverlayFita() {
  const s = useSegundos();
  return (
    <div className={`${css.overlay} ${css.fita}`}>
      <span className={css.cantoSE}>▶ PLAY</span>
      <span className={css.cantoID}>SP {Math.floor(s / 3600)}:{doisDigitos(Math.floor(s / 60) % 60)}:{doisDigitos(s % 60)}</span>
      <span className={css.cantoIE}>NOV. 09 1998</span>
    </div>
  );
}

function OverlayCamera() {
  const hora = useRelogio();
  return (
    <div className={`${css.overlay} ${css.camera}`}>
      <span className={css.cantoSE}>CAM AGT-07</span>
      <span className={`${css.cantoSD} ${css.rec}`}>● REC</span>
      <span className={css.cantoIE}>{hora}</span>
      <span className={css.cantoID}>
        BAT <span className={css.bateria}><span /></span>
      </span>
    </div>
  );
}

function Creditos({ onClose }: { onClose: () => void }) {
  return (
    <div className={css.creditos} role="dialog" aria-label="Créditos">
      <h2>Créditos</h2>
      <p>SCP Terror é um protótipo de fã, sem fins comerciais.</p>
      <p>
        Inspirado na <a href="https://scp-wiki.wikidot.com" target="_blank" rel="noreferrer">SCP Foundation</a> e no
        artigo <a href="https://scp-wiki.wikidot.com/scp-096" target="_blank" rel="noreferrer">SCP-096</a>, de {AUTOR_096}.
      </p>
      <p>
        O conteúdo da SCP Foundation é licenciado sob{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">
          Creative Commons Atribuição-CompartilhaIgual 3.0 (CC BY-SA 3.0)
        </a>
        . Elementos derivados deste projeto seguem a mesma licença.
      </p>
      <p>O monstro, a cena, as texturas e os shaders são originais deste projeto, feitos em código.</p>
      <button type="button" onClick={onClose}>Fechar</button>
    </div>
  );
}

export function Hud({ store, snap }: HudProps) {
  const [creditos, setCreditos] = useState(false);
  const estilo = STYLES.find((s) => s.id === snap.estilo);

  return (
    <>
      <div className={css.mira} />
      {snap.estilo === 'fita' && <OverlayFita />}
      {snap.estilo === 'camera' && <OverlayCamera />}

      <div className={css.topo}>
        <div className={css.estilos}>
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === snap.estilo ? css.ativo : undefined}
              onClick={(e) => {
                store.setStyle(s.id);
                e.currentTarget.blur();
              }}
            >
              {s.key} · {s.nome}
            </button>
          ))}
        </div>
        {estilo && (
          <div className={css.descricao}>
            <strong>{estilo.nome}</strong>
            <span>{estilo.frase}</span>
          </div>
        )}
      </div>

      {!snap.travado && <p className={css.ajuda}>{AJUDA}</p>}
      <button type="button" className={css.creditosBtn} onClick={() => setCreditos(true)}>
        Créditos
      </button>
      {creditos && <Creditos onClose={() => setCreditos(false)} />}
      {snap.pegouEm > 0 && <div key={snap.pegouEm} className={css.pegou} />}
    </>
  );
}
