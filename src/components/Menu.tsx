'use client';

import { useId, useState } from 'react';
import { FASES } from '../levels/indice';
import type { Opcoes as OpcoesT } from '../save/opcoes';
import type { Progresso } from '../save/progresso';
import type { Comando } from '../sim/tela';
import { Creditos } from './TelaCreditos';
import { formatarTempo } from './formato';
import css from './menus.module.css';
import { useNavegacaoMenu } from './navegacao';
import { Opcoes } from './Opcoes';

export interface MenuProps {
  progresso: Progresso;
  opcoes: OpcoesT;
  comando: (c: Comando) => void;
  definirOpcoes: (p: Partial<OpcoesT>) => void;
}

type Vista = 'raiz' | 'fases' | 'opcoes' | 'creditos';

function Raiz({ progresso, comando, ir }: { progresso: Progresso; comando: MenuProps['comando']; ir: (v: Vista) => void }) {
  const ref = useNavegacaoMenu<HTMLUListElement>();
  const continuar = progresso.desbloqueadas > 1;
  return (
    <ul ref={ref} className={css.lista} role="menu" aria-label="Menu principal">
      <li role="none"><button type="button" role="menuitem" className={css.item} onClick={() => comando({ c: 'novo_jogo' })}>Novo jogo</button></li>
      {continuar && (
        <li role="none"><button type="button" role="menuitem" className={css.item} onClick={() => comando({ c: 'continuar' })}>Continuar</button></li>
      )}
      <li role="none"><button type="button" role="menuitem" className={css.item} onClick={() => ir('fases')}>Seleção de fase</button></li>
      <li role="none"><button type="button" role="menuitem" className={css.item} onClick={() => ir('opcoes')}>Opções</button></li>
      <li role="none"><button type="button" role="menuitem" className={css.item} onClick={() => ir('creditos')}>Créditos</button></li>
    </ul>
  );
}

function Fases({ progresso, comando, voltar }: { progresso: Progresso; comando: MenuProps['comando']; voltar: () => void }) {
  const ref = useNavegacaoMenu<HTMLDivElement>(voltar);
  const abertas = FASES.slice(0, progresso.desbloqueadas);
  return (
    <div ref={ref}>
      <p className={css.rotulo}>Setores liberados</p>
      <ul className={css.lista} role="menu" aria-label="Seleção de fase">
        {abertas.map((f, i) => {
          const melhor = progresso.melhorTempo[f.id];
          return (
            <li key={f.id} role="none">
              <button type="button" role="menuitem" className={css.item} onClick={() => comando({ c: 'fase', indice: i })}
                aria-label={`${f.nome}${melhor ? `, melhor tempo ${formatarTempo(melhor)}` : ''}`}>
                <span>{i + 1}. {f.nome}</span>
                <small>{melhor ? formatarTempo(melhor) : '--:--'}</small>
              </button>
            </li>
          );
        })}
        <li role="none" className={css.voltar}>
          <button type="button" role="menuitem" className={css.item} onClick={voltar}>Voltar</button>
        </li>
      </ul>
    </div>
  );
}

/** Tela de título: a cena parada ao fundo, o menu à esquerda. */
export function Menu({ progresso, opcoes, comando, definirOpcoes }: MenuProps) {
  const [vista, setVista] = useState<Vista>('raiz');
  const titulo = useId();
  const raiz = () => setVista('raiz');
  if (vista === 'opcoes') return <Opcoes opcoes={opcoes} definir={definirOpcoes} voltar={raiz} />;
  if (vista === 'creditos') return <Creditos voltar={raiz} />;
  return (
    <div className={`${css.tela} ${css.titulo}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <div className={`${css.painel} ${css.semMoldura}`}>
        <p className={css.rotulo}>Terminal de acesso · Área de contenção</p>
        <h1 id={titulo} className={css.marca}>SCP Terror</h1>
        <span className={css.sub}>demo</span>
        {vista === 'raiz'
          ? <Raiz progresso={progresso} comando={comando} ir={setVista} />
          : <Fases progresso={progresso} comando={comando} voltar={raiz} />}
      </div>
    </div>
  );
}
