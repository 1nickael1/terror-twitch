'use client';

import { useId } from 'react';
import { STYLES } from '../looks/registry';
import type { Opcoes as OpcoesT, Qualidade } from '../save/opcoes';
import css from './menus.module.css';
import { useNavegacaoMenu } from './navegacao';

export interface OpcoesProps {
  opcoes: OpcoesT;
  definir: (p: Partial<OpcoesT>) => void;
  voltar: () => void;
}

const QUALIDADES: { id: Qualidade; nome: string }[] = [
  { id: 'baixa', nome: 'Baixa' }, { id: 'media', nome: 'Média' }, { id: 'alta', nome: 'Alta' },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Faixa(p: {
  nome: string; valor: number; min: number; max: number; passo: number; texto: string; mudar: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className={css.campo}>
      <label htmlFor={id}>{p.nome}</label>
      <output htmlFor={id}>{p.texto}</output>
      <input
        id={id} type="range" min={p.min} max={p.max} step={p.passo} value={p.valor}
        onChange={(e) => p.mudar(Number(e.target.value))}
      />
    </div>
  );
}

function Caixa(p: { nome: string; valor: boolean; mudar: (v: boolean) => void }) {
  return (
    <label className={css.caixa}>
      <input type="checkbox" checked={p.valor} onChange={(e) => p.mudar(e.target.checked)} />
      {p.nome}
    </label>
  );
}

/** Todas as opções, com efeito imediato (a gravação no navegador fica com o store). */
export function Opcoes({ opcoes: o, definir, voltar }: OpcoesProps) {
  const ref = useNavegacaoMenu<HTMLDivElement>(voltar);
  const titulo = useId();
  return (
    <div className={`${css.tela} ${css.veu}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <div ref={ref} className={`${css.painel} ${css.painelLargo}`}>
        <p className={css.rotulo}>Configuração do terminal</p>
        <h2 id={titulo} className={css.h2}>Opções</h2>

        <Faixa nome="Sensibilidade do mouse" valor={o.sensibilidade} min={0.2} max={3} passo={0.05}
          texto={o.sensibilidade.toFixed(2)} mudar={(v) => definir({ sensibilidade: v })} />
        <Caixa nome="Inverter eixo vertical" valor={o.inverterY} mudar={(v) => definir({ inverterY: v })} />
        <Faixa nome="Campo de visão" valor={o.fov} min={60} max={110} passo={1}
          texto={`${o.fov}°`} mudar={(v) => definir({ fov: v })} />
        <Faixa nome="Volume geral" valor={o.volumeGeral} min={0} max={1} passo={0.05}
          texto={pct(o.volumeGeral)} mudar={(v) => definir({ volumeGeral: v })} />
        <Faixa nome="Volume dos efeitos" valor={o.volumeEfeitos} min={0} max={1} passo={0.05}
          texto={pct(o.volumeEfeitos)} mudar={(v) => definir({ volumeEfeitos: v })} />
        <Faixa nome="Volume da música" valor={o.volumeMusica} min={0} max={1} passo={0.05}
          texto={pct(o.volumeMusica)} mudar={(v) => definir({ volumeMusica: v })} />

        <fieldset className={css.grupo}>
          <legend>Filtro visual</legend>
          <div className={css.escolhas}>
            {STYLES.map((s) => (
              <button key={s.id} type="button" className={css.escolha} aria-pressed={o.filtro === s.id}
                onClick={() => definir({ filtro: s.id })}>
                {s.nome}
                <small>{s.frase}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <Caixa nome="Reduzir flashes" valor={o.reduzirFlashes} mudar={(v) => definir({ reduzirFlashes: v })} />

        <fieldset className={css.grupo}>
          <legend>Qualidade</legend>
          <div className={`${css.escolhas} ${css.escolhasLinha}`}>
            {QUALIDADES.map((q) => (
              <button key={q.id} type="button" className={css.escolha} aria-pressed={o.qualidade === q.id}
                onClick={() => definir({ qualidade: q.id })}>
                {q.nome}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={css.botoes}>
          <button type="button" className={`${css.botao} ${css.primario}`} onClick={voltar}>Voltar</button>
        </div>
        <p className={`${css.texto} ${css.apagado}`} style={{ fontSize: 12, marginTop: 12 }}>
          As alterações valem na hora e ficam gravadas neste navegador.
        </p>
      </div>
    </div>
  );
}
