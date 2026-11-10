'use client';

import { useId, useState } from 'react';
import type { Opcoes as OpcoesT } from '../save/opcoes';
import type { Comando } from '../sim/tela';
import css from './menus.module.css';
import { useNavegacaoMenu } from './navegacao';
import { Opcoes } from './Opcoes';

export interface PausaProps {
  nomeFase: string;
  travaRecusada: boolean;
  opcoes: OpcoesT;
  comando: (c: Comando) => void;
  definirOpcoes: (p: Partial<OpcoesT>) => void;
}

function Raiz({ nomeFase, travaRecusada, comando, abrirOpcoes }: {
  nomeFase: string; travaRecusada: boolean; comando: PausaProps['comando']; abrirOpcoes: () => void;
}) {
  // Esc aqui não retoma: o navegador recusa a trava do ponteiro pedida pela tecla Esc
  const ref = useNavegacaoMenu<HTMLDivElement>();
  const titulo = useId();
  return (
    <div className={`${css.tela} ${css.veu}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <div ref={ref} className={css.painel}>
        <p className={css.rotulo}>Operação suspensa · {nomeFase}</p>
        <h2 id={titulo} className={css.h2}>Pausa</h2>
        <ul className={css.lista} role="menu" aria-label="Pausa">
          <li role="none"><button type="button" role="menuitem" className={css.item} onClick={() => comando({ c: 'retomar' })}>Continuar</button></li>
          <li role="none"><button type="button" role="menuitem" className={css.item} onClick={abrirOpcoes}>Opções</button></li>
          <li role="none"><button type="button" role="menuitem" className={css.item} onClick={() => comando({ c: 'sair' })}>Sair ao menu</button></li>
        </ul>
        {travaRecusada && (
          <p className={`${css.texto} ${css.apagado}`} role="status" style={{ fontSize: 13, margin: '12px 0 0' }}>
            O navegador recusou travar o mouse. Clique em Continuar de novo.
          </p>
        )}
      </div>
    </div>
  );
}

export function Pausa({ nomeFase, travaRecusada, opcoes, comando, definirOpcoes }: PausaProps) {
  const [emOpcoes, setEmOpcoes] = useState(false);
  if (emOpcoes) return <Opcoes opcoes={opcoes} definir={definirOpcoes} voltar={() => setEmOpcoes(false)} />;
  return <Raiz nomeFase={nomeFase} travaRecusada={travaRecusada} comando={comando} abrirOpcoes={() => setEmOpcoes(true)} />;
}
