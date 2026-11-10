'use client';

import { useId } from 'react';
import { useNavegacaoMenu } from './navegacao';
import css from './menus.module.css';

const CONTROLES = [
  ['W A S D', 'Mover'], ['Mouse', 'Olhar ao redor'], ['Clique esquerdo', 'Atirar'],
  ['E', 'Interagir / ler'], ['F', 'Ligar ou apagar a lanterna'], ['Espaço', 'Pular'],
  ['Shift', 'Andar devagar'], ['1 – 4 / roda', 'Trocar de arma'], ['Esc', 'Pausar'],
];

export function Controles({ voltar }: { voltar: () => void }) {
  const titulo = useId();
  const ref = useNavegacaoMenu<HTMLDivElement>(voltar);
  return (
    <div className={`${css.tela} ${css.veu}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <div ref={ref} className={css.painel}>
        <p className={css.rotulo}>Manual de sobrevivência</p>
        <h2 id={titulo} className={css.h2} tabIndex={-1} data-foco-inicial>Antes de entrar</h2>
        <p className={`${css.texto} ${css.apagado}`}>O som denuncia sua presença. Ande devagar, procure cartões e observe os avisos antes de avançar.</p>
        <dl className={css.controles}>
          {CONTROLES.map(([tecla, acao]) => <div key={tecla}><dt><kbd>{tecla}</kbd></dt><dd>{acao}</dd></div>)}
        </dl>
        <p className={`${css.texto} ${css.apagado}`}>Use fones para localizar ameaças. Volume, filtros e redução de flashes estão em Opções.</p>
        <div className={css.botoes}><button className={`${css.botao} ${css.primario}`} type="button" onClick={voltar}>Voltar</button></div>
      </div>
    </div>
  );
}
