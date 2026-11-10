'use client';

import css from './menus.module.css';

/** Tela curta enquanto o `Game` espera 2 s para voltar ao checkpoint (sem controles). */
export function Morte() {
  return (
    <div className={`${css.tela} ${css.morte}`} role="alertdialog" aria-modal="true" aria-labelledby="morte-titulo" aria-live="assertive">
      <div>
        <p className={css.rotulo}>Sinais vitais: ausentes</p>
        <h2 id="morte-titulo" className={css.marca}>Você morreu</h2>
        <p className={css.texto}>Retornando ao último checkpoint...</p>
      </div>
    </div>
  );
}
