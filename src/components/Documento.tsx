'use client';

import { useEffect, useId, useRef } from 'react';
import type { DocumentoDef } from '../sim/fase';
import css from './menus.module.css';

export interface DocumentoProps {
  doc: DocumentoDef;
  /** volta ao jogo (E ou o botão) */
  fechar: () => void;
  /** Esc: fecha direto para a pausa (o navegador não trava o mouse a partir do Esc) */
  fecharParaPausa: () => void;
}

/** Leitor de documento: E ou o botão voltam ao jogo; Esc fecha para a pausa. */
export function Documento({ doc, fechar, fecharParaPausa }: DocumentoProps) {
  const titulo = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const fecharRef = useRef(fechar);
  const pausaRef = useRef(fecharParaPausa);
  useEffect(() => {
    fecharRef.current = fechar;
    pausaRef.current = fecharParaPausa;
  });

  useEffect(() => {
    botao.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        pausaRef.current();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        fecharRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`${css.tela} ${css.veu}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <article className={`${css.painel} ${css.documento}`}>
        <p className={css.rotulo}>Documento recuperado · {doc.id}</p>
        <h2 id={titulo} className={css.h2}>{doc.titulo}</h2>
        <p className={css.corpo}>{doc.texto}</p>
        <div className={css.botoes}>
          <button ref={botao} type="button" className={css.botao} onClick={fechar}>Fechar</button>
        </div>
        <p className={css.dica}>E para voltar ao jogo · Esc para pausar</p>
      </article>
    </div>
  );
}
