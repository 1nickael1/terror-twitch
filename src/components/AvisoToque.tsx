'use client';

import { useSyncExternalStore } from 'react';
import css from './menus.module.css';

const SO_TOQUE = '(pointer: coarse)';
const PONTEIRO_FINO = '(any-pointer: fine)';

function assinar(aviso: () => void): () => void {
  const consultas = [window.matchMedia(SO_TOQUE), window.matchMedia(PONTEIRO_FINO)];
  for (const c of consultas) c.addEventListener('change', aviso);
  return () => {
    for (const c of consultas) c.removeEventListener('change', aviso);
  };
}

const soToque = () => window.matchMedia(SO_TOQUE).matches && !window.matchMedia(PONTEIRO_FINO).matches;

/**
 * Aparelho só de toque (sem mouse nem trackpad). Lido só no navegador: no servidor e na hidratação
 * vale `false` (getServerSnapshot), e o valor real chega depois de montar.
 */
export function useSoToque(): boolean {
  return useSyncExternalStore(assinar, soToque, () => false);
}

export function AvisoToque() {
  return (
    <div className={`${css.tela} ${css.titulo}`} role="dialog" aria-modal="true" aria-labelledby="aviso-toque">
      <div className={`${css.painel} ${css.semMoldura}`}>
        <p className={css.rotulo}>Terminal de acesso · Área de contenção</p>
        <h1 className={css.marca}>SCP Terror</h1>
        <span className={css.sub}>demo</span>
        <p id="aviso-toque" className={css.texto}>Esta demo precisa de teclado e mouse.</p>
        <p className={`${css.texto} ${css.apagado}`}>Abra esta página num computador para jogar.</p>
      </div>
    </div>
  );
}
