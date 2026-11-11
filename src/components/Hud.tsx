'use client';

import { useEffect, useState } from 'react';
import { CORES_CARTAO } from '../engine/coresCartao';
import { ARMAS, JOGADOR, ORDEM_ARMAS } from '../sim/balance';
import type { HudSnapshot } from './engineStore';
import css from './game.module.css';

/** HUD de jogo: só desenha o snapshot (nada por quadro passa por aqui). */
export interface HudProps {
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
    <div className={`${css.overlay} ${css.fita}`} aria-hidden="true">
      <span className={css.cantoSE}>▶ PLAY</span>
      <span className={css.cantoID}>SP {Math.floor(s / 3600)}:{doisDigitos(Math.floor(s / 60) % 60)}:{doisDigitos(s % 60)}</span>
      <span className={css.cantoIE}>NOV. 09 1998</span>
    </div>
  );
}

function OverlayCamera() {
  const hora = useRelogio();
  return (
    <div className={`${css.overlay} ${css.camera}`} aria-hidden="true">
      <span className={css.cantoSE}>CAM AGT-07</span>
      <span className={`${css.cantoSD} ${css.rec}`}>● REC</span>
      <span className={css.cantoIE}>{hora}</span>
      <span className={css.cantoID}>
        BAT <span className={css.bateria}><span /></span>
      </span>
    </div>
  );
}

function Medidor({ nome, valor, max, classe }: { nome: string; valor: number; max: number; classe: string }) {
  const fracao = Math.max(0, Math.min(1, valor / max));
  return (
    <div className={`${css.medidor} ${classe}`}>
      <span className={css.medidorNome}>{nome}</span>
      <span className={css.medidorValor}>{valor}</span>
      <span className={css.barra} role="meter" aria-label={nome} aria-valuemin={0} aria-valuemax={max} aria-valuenow={valor}>
        <span style={{ transform: `scaleX(${fracao})` }} />
      </span>
    </div>
  );
}

function BarraDoChefe({ nome, vida }: { nome: string; vida: number }) {
  const pct = Math.round(vida * 100);
  return (
    <div className={css.chefe}>
      <span className={css.chefeNome}>{nome}</span>
      <span className={css.chefeBarra} role="meter" aria-label={`Vida de ${nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ transform: `scaleX(${vida})` }} />
      </span>
    </div>
  );
}

const CLASSE_DANO = { frente: css.danoFrente, tras: css.danoTras, esquerda: css.danoEsquerda, direita: css.danoDireita } as const;

export function Hud({ snap }: HudProps) {
  const arma = ARMAS[snap.arma];
  const cartoes = [...snap.cartoes].sort((a, b) => a - b);
  return (
    <div className={css.hud}>
      <div className={css.setor}><span>{snap.fase < 0 ? 'TREINAMENTO / 04 ARMAS' : `SETOR / ${String(snap.fase + 1).padStart(2, '0')}`}</span><strong>{snap.nomeFase}</strong></div>
      {snap.fase < 0 && <div className={css.dicaTreino}>1–4 armas · Itens atrás da linha de tiro · Esc: reiniciar / sair</div>}
      {snap.filtro === 'fita' && <OverlayFita />}
      {snap.filtro === 'camera' && <OverlayCamera />}

      {snap.danoEm > 0 && (
        <div
          key={snap.danoEm}
          className={`${css.dano} ${snap.danoLado ? CLASSE_DANO[snap.danoLado] : css.danoTodo} ${snap.opcoes.reduzirFlashes ? css.danoSuave : ''}`}
          aria-hidden="true"
        />
      )}

      <div className={css.mira} aria-hidden="true" />
      {snap.dicaUso && <p className={css.dicaUso}>{snap.dicaUso}</p>}

      {snap.chefe && <BarraDoChefe nome={snap.chefe.nome} vida={snap.chefe.vida} />}

      {cartoes.length > 0 && (
        <ul className={css.cartoes} aria-label="Cartões de acesso">
          {cartoes.map((n) => (
            <li key={n} className={css.cartao} style={{ background: CORES_CARTAO[n].css }}
              aria-label={`Cartão nível ${n} (${CORES_CARTAO[n].nome})`}>
              N{n}
            </li>
          ))}
        </ul>
      )}

      {snap.mensagem && <p className={css.mensagem} role="status">{snap.mensagem}</p>}

      <div className={css.status}>
        <Medidor nome="Vida" valor={snap.vida} max={JOGADOR.vidaMax} classe={snap.vida <= 25 ? css.critico : css.vida} />
        <Medidor nome="Colete" valor={snap.colete} max={JOGADOR.coleteMax} classe={css.colete} />
      </div>

      <div className={css.armamento}>
        <span className={css.armaNome}>{arma.nome}</span>
        <span className={css.municao} aria-label={`Munição: ${snap.municao}`}>{snap.municao}</span>
        <ol className={css.slots} aria-label="Armas">
          {ORDEM_ARMAS.map((id, i) => {
            const tem = snap.armas.includes(id);
            const atual = id === snap.arma;
            return (
              <li key={id} className={`${css.slot} ${tem ? css.slotTem : ''} ${atual ? css.slotAtual : ''}`}
                aria-label={`${i + 1}: ${tem ? ARMAS[id].nome : 'vazio'}${atual ? ' (na mão)' : ''}`}>
                {i + 1}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
