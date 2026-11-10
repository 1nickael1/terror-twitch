'use client';

import { useId } from 'react';
import { CREDITOS } from './creditos';
import css from './menus.module.css';
import { useNavegacaoMenu } from './navegacao';

export function Creditos({ voltar }: { voltar: () => void }) {
  const ref = useNavegacaoMenu<HTMLDivElement>(voltar);
  const titulo = useId();
  const c = CREDITOS;
  return (
    <div className={`${css.tela} ${css.veu}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <div ref={ref} className={`${css.painel} ${css.painelLargo}`}>
        <p className={css.rotulo}>Registro de atribuições</p>
        <h2 id={titulo} className={css.h2}>{c.titulo}</h2>
        <p className={css.texto}>{c.aviso}</p>
        <dl className={css.creditos}>
          <div>
            <dt>Universo</dt>
            <dd>
              <a className={css.link} href={c.fundacao.url} target="_blank" rel="noreferrer">{c.fundacao.texto}</a>
            </dd>
          </div>
          {c.entidades.map((e) => (
            <div key={e.numero}>
              <dt>{e.numero}</dt>
              <dd>
                Autor: {e.autor} ·{' '}
                <a className={css.link} href={e.url} target="_blank" rel="noreferrer">página do artigo</a>
              </dd>
            </div>
          ))}
          <div>
            <dt>Licença</dt>
            <dd>
              <a className={css.link} href={c.licenca.url} target="_blank" rel="noreferrer">{c.licenca.texto}</a>
            </dd>
          </div>
        </dl>
        {c.frases.map((f) => <p key={f} className={`${css.texto} ${css.apagado}`} style={{ marginTop: 12 }}>{f}</p>)}
        <div className={css.botoes}>
          <button type="button" className={`${css.botao} ${css.primario}`} onClick={voltar} data-foco-inicial>Voltar</button>
        </div>
      </div>
    </div>
  );
}
