'use client';

import { useId, useState } from 'react';
import { FASES } from '../levels/indice';
import type { Opcoes as OpcoesT } from '../save/opcoes';
import type { Progresso } from '../save/progresso';
import type { Comando } from '../sim/tela';
import { Creditos } from './TelaCreditos';
import { formatarTempo } from './formato';
import { fasesDaSelecao } from './selecao';
import css from './menus.module.css';
import { useNavegacaoMenu } from './navegacao';
import { Opcoes } from './Opcoes';
import { Controles } from './Controles';

export interface MenuProps {
  progresso: Progresso;
  opcoes: OpcoesT;
  comando: (c: Comando) => void;
  definirOpcoes: (p: Partial<OpcoesT>) => void;
}

type Vista = 'raiz' | 'fases' | 'opcoes' | 'creditos' | 'controles';

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
  const abertas = fasesDaSelecao(FASES, progresso);
  return (
    <div ref={ref}>
      <p className={css.rotulo}>Setores liberados</p>
      <ul className={css.lista} role="menu" aria-label="Seleção de fase">
        {abertas.map(({ indice, id, nome, melhor }) => (
          <li key={id} role="none">
            <button type="button" role="menuitem" className={css.item} onClick={() => comando({ c: 'fase', indice })}
              aria-label={`${nome}${melhor ? `, melhor tempo ${formatarTempo(melhor)}` : ''}`}>
              <span>{indice + 1}. {nome}</span>
              <small>{melhor ? formatarTempo(melhor) : '--:--'}</small>
            </button>
          </li>
        ))}
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
  if (vista === 'controles') return <Controles voltar={raiz} />;
  return (
    <div className={`${css.tela} ${css.titulo}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <div className={css.cabecalhoTerminal} aria-hidden="true"><span>SCPT / REDE INTERNA</span><span className={css.sinal}>● CONEXÃO INSTÁVEL</span></div>
      <div className={`${css.painel} ${css.semMoldura}`}>
        <p className={css.rotulo}>Protocolo de emergência / 07</p>
        <h1 id={titulo} className={css.marca}><span>SCP</span><span className={css.marcaTerror}>TERROR</span></h1>
        <span className={css.sub}>Falha de contenção</span>
        <p className={css.sinopse}>O isolamento falhou.<br />Encontre uma saída. Evite o que ficou.</p>
        {vista === 'raiz'
          ? <Raiz progresso={progresso} comando={comando} ir={setVista} />
          : <Fases progresso={progresso} comando={comando} voltar={raiz} />}
      </div>
      <aside className={css.transmissao} aria-label="Estado da instalação">
        <span className={css.rotulo}>Vigilância / sinal ao vivo</span>
        <div className={css.selo} aria-hidden="true">!</div>
        <p>CONTENÇÃO<br /><strong>COMPROMETIDA</strong></p>
        <span className={css.codigo}>ACESSO RESTRITO · NÍVEL 04</span>
      </aside>
      <footer className={css.rodapeTerminal}><span><kbd>↑</kbd> <kbd>↓</kbd> navegar <kbd>Enter</kbd> selecionar</span><button type="button" className={css.ajuda} onClick={() => setVista('controles')}>Controles / manual ↗</button><span>DEMO / 02 SETORES</span></footer>
    </div>
  );
}
